#!/usr/bin/env python3
"""
Extract coordinates of numeric text elements from an SVG file.
Usage: python svg_text_coords.py input.svg [output.json] [--debug]
"""

import sys
import json
import re
from xml.etree import ElementTree as ET


def is_numeric(text: str) -> bool:
    return bool(re.fullmatch(r"-?\d+(\.\d+)?", text.strip()))


def parse_transform(transform_str: str) -> tuple:
    tx, ty = 0.0, 0.0

    # matrix(a,b,c,d,tx,ty)
    for m in re.finditer(
        r"matrix\(\s*"
        r"[+-]?\d*\.?\d+[,\s]+"   # a
        r"[+-]?\d*\.?\d+[,\s]+"   # b
        r"[+-]?\d*\.?\d+[,\s]+"   # c
        r"[+-]?\d*\.?\d+[,\s]+"   # d
        r"([+-]?\d*\.?\d+)[,\s]+" # tx
        r"([+-]?\d*\.?\d+)"       # ty
        r"\s*\)",
        transform_str
    ):
        tx += float(m.group(1))
        ty += float(m.group(2))

    # translate(tx, ty)
    for m in re.finditer(
        r"translate\(\s*([+-]?\d*\.?\d+)[,\s]+([+-]?\d*\.?\d+)\s*\)",
        transform_str
    ):
        tx += float(m.group(1))
        ty += float(m.group(2))

    return tx, ty


def get_xy(elem) -> tuple:
    x_attr = elem.get("x")
    y_attr = elem.get("y")
    tx, ty = parse_transform(elem.get("transform", ""))

    if x_attr is not None and y_attr is not None:
        fx, fy = float(x_attr), float(y_attr)
        # Only add transform offset if x/y are not literally "0"
        # (when x=0 y=0 it means the real position is in the transform)
        if fx == 0.0 and fy == 0.0 and (tx != 0.0 or ty != 0.0):
            return tx, ty
        return fx + tx, fy + ty

    if tx != 0.0 or ty != 0.0:
        return tx, ty

    # Check tspan children
    for child in elem:
        child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if child_tag == "tspan":
            cx = child.get("x")
            cy = child.get("y")
            ctx, cty = parse_transform(child.get("transform", ""))
            if cx is not None and cy is not None:
                fcx, fcy = float(cx), float(cy)
                if fcx == 0.0 and fcy == 0.0 and (ctx != 0.0 or cty != 0.0):
                    return ctx, cty
                return fcx + ctx, fcy + cty
            if ctx != 0.0 or cty != 0.0:
                return ctx, cty

    return 0.0, 0.0


def extract_numeric_texts(svg_path: str) -> list:
    tree = ET.parse(svg_path)
    root = tree.getroot()
    results = []

    for elem in root.iter():
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        if tag != "text":
            continue

        full_text = "".join(elem.itertext()).strip()
        if not full_text or not is_numeric(full_text):
            continue

        x, y = get_xy(elem)
        results.append({"text": full_text, "x": round(x, 5), "y": round(y, 5)})

    return results


def debug_svg(svg_path: str):
    tree = ET.parse(svg_path)
    root = tree.getroot()
    print("=== DEBUG: all <text> elements ===")
    for elem in root.iter():
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        if tag == "text":
            full_text = "".join(elem.itertext()).strip()
            print(f"  text={repr(full_text):30s}  attribs={dict(elem.attrib)}")
            for child in elem:
                ctag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                ctext = "".join(child.itertext()).strip()
                print(f"    └─ <{ctag}> text={repr(ctext):20s}  attribs={dict(child.attrib)}")
    print("==================================")


def main():
    if len(sys.argv) < 2:
        print("Usage: python svg_text_coords.py input.svg [output.json] [--debug]")
        sys.exit(1)

    svg_path = sys.argv[1]
    args = sys.argv[2:]
    debug = "--debug" in args
    output_args = [a for a in args if not a.startswith("--")]
    output_path = output_args[0] if output_args else svg_path.replace(".svg", "_coords.json")

    if debug:
        debug_svg(svg_path)

    data = extract_numeric_texts(svg_path)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Found {len(data)} numeric text element(s). Saved to: {output_path}")
