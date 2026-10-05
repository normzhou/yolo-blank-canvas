#!/usr/bin/env python3
"""Install one shared skill and thin repo-local commands; no adoption or GitHub writes."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

BUNDLE = Path(__file__).resolve().parents[1]
SKILL = '.agents/skills/yolo'
CLAUDE = '.claude/skills/yolo'
CLAUDE_LINK = '../../.agents/skills/yolo'
PROMPT = 'Read `.agents/skills/yolo/SKILL.md` from the repository root and follow the requested activity.\nUser request: $ARGUMENTS\n'
MARKDOWN = '---\ndescription: YOLO Dev — init, check, request, work, feedback, help\n---\n\n' + PROMPT
BINDINGS = {
    '.pi/prompts/yolo.md': MARKDOWN,
    '.opencode/commands/yolo.md': MARKDOWN,
    '.gemini/commands/yolo.toml': 'description = "YOLO Dev — init, check, request, work, feedback, help"\nprompt = """' + PROMPT.replace('$ARGUMENTS', '{{args}}') + '"""\n',
}
INSTRUCTIONS = {'CLAUDE.md': '@AGENTS.md\n', 'GEMINI.md': '@./AGENTS.md\n'}


def files(root):
    return {str(p.relative_to(root)): p.read_bytes() for p in root.rglob('*')
            if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc'}


def install(target):
    target = Path(target).resolve()
    top = subprocess.check_output(['git', '-C', str(target), 'rev-parse', '--show-toplevel'], text=True).strip()
    if Path(top).resolve() != target:
        raise ValueError('Run installation against the repository root')
    outputs = [SKILL, CLAUDE, *BINDINGS, *INSTRUCTIONS]
    for name in outputs:
        # The expected Claude symlink resolves to the shared bundle inside the repo.
        if not (target / name).resolve().is_relative_to(target):
            raise ValueError('Binding escapes target repository: ' + name)
        for parent in (target / name).parents:
            if parent == target:
                break
            if parent.exists() and not parent.is_dir():
                raise ValueError('Binding parent is not a directory: ' + str(parent.relative_to(target)))
    legacy = target / '.agents/skills/yolo-dev'
    if legacy.exists() or legacy.is_symlink():
        raise ValueError('Existing yolo-dev installation needs an explicit migration; no files changed')
    conflicts = []
    destination = target / SKILL
    source_files = files(BUNDLE)
    if destination.exists() or destination.is_symlink():
        if destination.is_symlink() or not destination.is_dir() or files(destination) != source_files:
            conflicts.append(SKILL)
    link = target / CLAUDE
    if link.exists() or link.is_symlink():
        if not link.is_symlink() or str(link.readlink()) != CLAUDE_LINK:
            conflicts.append(CLAUDE)
    for name, body in BINDINGS.items():
        path = target / name
        if path.exists() or path.is_symlink():
            if path.is_symlink() or not path.is_file() or path.read_text() != body:
                conflicts.append(name)
    for name in INSTRUCTIONS:
        path = target / name
        if path.exists() or path.is_symlink():
            if path.is_symlink() or not path.is_file() or not any(
                line.strip() in ('@AGENTS.md', '@./AGENTS.md') for line in path.read_text().splitlines()
            ):
                conflicts.append(name)
    if conflicts:
        raise ValueError('Conflicting bindings; no files changed: ' + ', '.join(conflicts))
    if not destination.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(BUNDLE, destination, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    if not link.is_symlink():
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to(CLAUDE_LINK, target_is_directory=True)
    for name, body in {**BINDINGS, **INSTRUCTIONS}.items():
        path = target / name
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body)
    return {'installed': outputs, 'adoption': 'unchanged', 'harness_support': 'requires observed fresh-session verification'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', type=Path, help='Repository root; for dry run, use the retained preview')
    args = parser.parse_args()
    try:
        print(json.dumps(install(args.target), indent=2))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
