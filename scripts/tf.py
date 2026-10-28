"""Minimal Text-Fabric (.tf) reader, shared by build_dss.py and build_bhsa.py.

Format: '@' header lines, a blank line, then one line per node:
'value' (next node), 'node<TAB>value', or 'from-to<TAB>value'.
"""
import re


def read_tf(path, parse=lambda v: v):
    out = {}
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")
    i = 0
    while i < len(lines) and lines[i].startswith("@"):
        i += 1
    n = 0
    body = lines[i + 1:]
    if body and body[-1] == "":
        body.pop()  # final newline
    for line in body:
        if not line:  # a blank line is an empty value for the next node
            n += 1
            out[n] = ""
            continue
        if "\t" in line:
            k, v = line.split("\t", 1)
            a, _, b = k.partition("-")
            a, b = int(a), int(b or a)
        else:
            a = b = n + 1
            v = line
        v = parse(v.replace("\\t", "\t").replace("\\n", "\n").replace("\\\\", "\\"))
        for x in range(a, b + 1):
            out[x] = v
        n = b
    return out


def read_otype(path):
    """{node type: (first node, last node)}"""
    ranges = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            if "\t" in line and not line.startswith("@"):
                k, t = line.rstrip("\n").split("\t")
                a, b = map(int, k.split("-"))
                ranges[t] = (a, b)
    return ranges


def slot_bounds(v):
    """'1-3,5' -> (1, 5)"""
    nums = [int(x) for x in re.split(r"[-,]", v)]
    return min(nums), max(nums)


def slot_list(v):
    """'1-3,5' -> [1, 2, 3, 5]"""
    out = []
    for part in v.split(","):
        a, _, b = part.partition("-")
        out.extend(range(int(a), int(b or a) + 1))
    return out
