#!/usr/bin/env python3
"""
validate_skill.py - Automated structural and metadata validator for AI Agent Skills.
Adheres to 2026 Agent Skills Specification.
"""

import sys
import os
import re
import argparse
from pathlib import Path

def parse_frontmatter(content: str):
    """Extract and parse YAML frontmatter from markdown content."""
    pattern = r"^---\s*\n(.*?)\n---\s*\n"
    match = re.match(pattern, content, re.DOTALL)
    if not match:
        return None, "No YAML frontmatter found. SKILL.md must start with '---' delimited frontmatter."
    
    raw_yaml = match.group(1)
    fields = {}
    for line in raw_yaml.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, val = line.split(":", 1)
            fields[key.strip()] = val.strip().strip("\"'")
    
    return fields, None

def validate_skill_file(skill_path: Path) -> bool:
    """Run all validation checks on a target SKILL.md file."""
    print(f"\n🔍 Validating Skill: {skill_path}")
    print("=" * 60)

    if not skill_path.exists():
        print(f"❌ ERROR: File does not exist at {skill_path}")
        return False

    with open(skill_path, "r", encoding="utf-8") as f:
        content = f.read()

    errors = []
    warnings = []

    # 1. Frontmatter Validation
    fields, err = parse_frontmatter(content)
    if err:
        errors.append(err)
    else:
        # Check 'name'
        if "name" not in fields or not fields["name"]:
            errors.append("Missing required 'name' field in frontmatter.")
        else:
            name = fields["name"]
            if not re.match(r"^[a-z0-9-]+$", name):
                errors.append(f"Invalid 'name': '{name}'. Must be kebab-case (lowercase letters, numbers, hyphens only).")
            else:
                print(f"  ✓ Name valid: '{name}'")

        # Check 'description'
        if "description" not in fields or not fields["description"]:
            errors.append("Missing required 'description' field in frontmatter.")
        else:
            desc = fields["description"]
            desc_len = len(desc)
            if desc_len < 30:
                warnings.append(f"Description is very short ({desc_len} chars). Consider adding trigger conditions and negative boundaries.")
            elif desc_len > 450:
                warnings.append(f"Description is long ({desc_len} chars). Keep under 400 chars to save router context.")
            else:
                print(f"  ✓ Description valid ({desc_len} chars)")

    # 2. Line count & Progressive Disclosure check
    lines = content.splitlines()
    total_lines = len(lines)
    if total_lines > 400:
        warnings.append(f"File has {total_lines} lines. Recommended max for SKILL.md is 400 lines. Move deep reference tables to 'references/' directory.")
    else:
        print(f"  ✓ Line count optimal: {total_lines} lines")

    # 3. Check Section Structure
    has_workflow = bool(re.search(r"##\s+.*(?:Workflow|Process|Steps|Fases|Fluxo)", content, re.IGNORECASE))
    if not has_workflow:
        warnings.append("No explicit 'Workflow', 'Process', or 'Steps' section found in SKILL.md.")
    else:
        print("  ✓ Procedural workflow section detected")

    # 4. Check for Internal Reference Links & Portability
    link_pattern = r"\[.*?\]\((file:\/\/\/?[^\)]+|(?:\.\/|\.\.\/|[a-zA-Z0-9_\-\/]+)[^\)]+\.md)\)"
    links = re.findall(link_pattern, content)
    
    skill_dir = skill_path.parent
    for link in links:
        # Check portability (relative links vs hardcoded paths)
        if link.startswith("file://") or (os.name == "nt" and re.match(r"^[a-zA-Z]:", link)) or link.startswith("/home") or link.startswith("/Users"):
            warnings.append(f"Hardcoded absolute path detected: '{link}'. Use relative paths (e.g. 'references/...') for portability across systems.")

        # Normalize file:// links or relative links
        clean_path = link.replace("file:///", "").replace("file://", "")
        if os.name == 'nt' and clean_path.startswith('/') and len(clean_path) > 2 and clean_path[2] == ':':
            clean_path = clean_path[1:] # fix /C:/ -> C:/
        
        target = Path(clean_path)
        if not target.is_absolute():
            target = (skill_dir / clean_path).resolve()

        if not target.exists():
            warnings.append(f"Linked reference file not found: {link} (resolved: {target})")
        else:
            print(f"  ✓ Valid internal link: {target.name}")

    # Summary
    print("-" * 60)
    if warnings:
        print("⚠️  WARNINGS:")
        for w in warnings:
            print(f"   - {w}")

    if errors:
        print("❌ ERRORS:")
        for e in errors:
            print(f"   - {e}")
        print("\nResult: ❌ FAILED")
        return False

    print("\nResult: ✅ PASSED (Skill complies with 2026 standards)")
    return True

def main():
    parser = argparse.ArgumentParser(description="Validate AI Agent Skill structural and metadata integrity.")
    parser.add_argument("path", help="Path to SKILL.md or the skill folder")
    args = parser.parse_args()

    target_path = Path(args.path)
    if target_path.is_dir():
        target_path = target_path / "SKILL.md"

    success = validate_skill_file(target_path)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
