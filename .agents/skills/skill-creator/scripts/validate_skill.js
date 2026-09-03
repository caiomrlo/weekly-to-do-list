#!/usr/bin/env node
/**
 * validate_skill.js - Structural and metadata validator for AI Agent Skills.
 * Adheres to 2026 Agent Skills Specification.
 */

const fs = require('fs');
const path = require('path');

function parseFrontmatter(content) {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!match) {
    return { fields: null, error: "No YAML frontmatter found. SKILL.md must start with '---' delimited frontmatter." };
  }
  const rawYaml = match[1];
  const fields = {};
  for (const line of rawYaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fields[key] = val;
    }
  }
  return { fields, error: null };
}

function validateSkillFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  const targetPath = fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()
    ? path.join(resolvedPath, 'SKILL.md')
    : resolvedPath;

  console.log(`\n🔍 Validating Skill: ${targetPath}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ ERROR: File does not exist at ${targetPath}`);
    return false;
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  const errors = [];
  const warnings = [];

  // 1. Frontmatter Validation
  const { fields, error } = parseFrontmatter(content);
  if (error) {
    errors.push(error);
  } else {
    // Check 'name'
    if (!fields.name) {
      errors.push("Missing required 'name' field in frontmatter.");
    } else if (!/^[a-z0-9-]+$/.test(fields.name)) {
      errors.push(`Invalid 'name': '${fields.name}'. Must be kebab-case (lowercase letters, numbers, hyphens only).`);
    } else {
      console.log(`  ✓ Name valid: '${fields.name}'`);
    }

    // Check 'description'
    if (!fields.description) {
      errors.push("Missing required 'description' field in frontmatter.");
    } else {
      const descLen = fields.description.length;
      if (descLen < 30) {
        warnings.push(`Description is very short (${descLen} chars). Consider adding trigger conditions and negative boundaries.`);
      } else if (descLen > 450) {
        warnings.push(`Description is long (${descLen} chars). Keep under 400 chars to save router context.`);
      } else {
        console.log(`  ✓ Description valid (${descLen} chars)`);
      }
    }
  }

  // 2. Line count & Progressive Disclosure check
  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;
  if (totalLines > 400) {
    warnings.push(`File has ${totalLines} lines. Recommended max for SKILL.md is 400 lines. Move deep reference tables to 'references/' directory.`);
  } else {
    console.log(`  ✓ Line count optimal: ${totalLines} lines`);
  }

  // 3. Check Section Structure
  const hasWorkflow = /##\s+.*(?:Workflow|Process|Steps|Fases|Fluxo)/i.test(content);
  if (!hasWorkflow) {
    warnings.push("No explicit 'Workflow', 'Process', or 'Steps' section found in SKILL.md.");
  } else {
    console.log('  ✓ Procedural workflow section detected');
  }

  // 4. Check Internal Reference Links & Portability
  const linkRegex = /\[.*?\]\((file:\/\/\/?[^\)]+|(?:\.\/|\.\.\/|[a-zA-Z0-9_\-\/]+)[^\)]+\.md)\)/g;
  let match;
  const skillDir = path.dirname(targetPath);
  while ((match = linkRegex.exec(content)) !== null) {
    const rawLink = match[1];

    if (rawLink.startsWith('file://') || (process.platform === 'win32' && /^[a-zA-Z]:/.test(rawLink)) || rawLink.startsWith('/home') || rawLink.startsWith('/Users')) {
      warnings.push(`Hardcoded absolute path detected: '${rawLink}'. Use relative paths (e.g. 'references/...') for portability across systems.`);
    }

    let cleanPath = rawLink.replace(/^file:\/\/\/?/, '');
    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(cleanPath)) {
      cleanPath = cleanPath.slice(1);
    }

    const checkTarget = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(skillDir, cleanPath);
    if (!fs.existsSync(checkTarget)) {
      warnings.push(`Linked reference file not found: ${rawLink} (resolved: ${checkTarget})`);
    } else {
      console.log(`  ✓ Valid internal link: ${path.basename(checkTarget)}`);
    }
  }

  // Summary
  console.log('-'.repeat(60));
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('❌ ERRORS:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nResult: ❌ FAILED');
    return false;
  }

  console.log('\nResult: ✅ PASSED (Skill complies with 2026 standards)');
  return true;
}

const target = process.argv[2];
if (!target) {
  console.log('Usage: node validate_skill.js <path-to-SKILL.md-or-skill-dir>');
  process.exit(1);
}

const ok = validateSkillFile(target);
process.exit(ok ? 0 : 1);
