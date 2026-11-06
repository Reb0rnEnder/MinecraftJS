"""Index cached historical release HTML; retain labels/issue IDs, not article prose.
Usage: python3 tools/port-1.20.6/index-release-history.py CACHE_DIRECTORY OUTPUT_JSON
Raw fetched HTML remains in ignored cache. Indexing is not feature acceptance.
"""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re
import sys

VERSIONS = ['1.20', '1.20.1', '1.20.2', '1.20.3', '1.20.4', '1.20.5', '1.20.6']


class Node:
    def __init__(self, tag, attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def text(self):
        return ''.join(c if isinstance(c, str) else c.text() for c in self.children)

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node('root')

    def handle_starttag(self, tag, attrs):
        child = Node(tag, attrs, self.current)
        self.current.children.append(child)
        if tag not in {'br', 'img', 'hr', 'meta', 'link', 'input', 'source', 'wbr',
                       'area', 'base', 'embed', 'param', 'track', 'col'}:
            self.current = child

    def handle_endtag(self, tag):
        node = self.current
        while node.parent is not None:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, text):
        self.current.children.append(text)


def clean(text):
    return re.sub(r'\s+', ' ', text).replace('[edit]', '').strip()


def index(directory):
    releases = []
    for version in VERSIONS:
        raw = (directory / ('minecraft.wiki-' + version + '.html')).read_bytes()
        parser = Parser()
        parser.feed(raw.decode('utf-8'))
        content = next(n for n in parser.root.walk()
                       if 'mw-parser-output' in n.attrs.get('class', '').split())
        scope, path, topics, fixes, unkeyed = None, [], [], set(), 0
        for node in content.walk():
            if re.fullmatch(r'h[2-6]', node.tag):
                level, title = int(node.tag[1]), clean(node.text())
                if level == 2:
                    scope = title if title in {'Additions', 'Changes', 'Experimental', 'Fixes'} else None
                path = [(n, text) for n, text in path if n < level] + [(level, title)]
                if scope:
                    anchor = node.attrs.get('id') or next((n.attrs['id'] for n in node.walk() if n.attrs.get('id')), '')
                    topics.append({'section': scope, 'path': [text for _, text in path],
                                   'anchor': anchor, 'kind': 'heading', 'status': 'indexed; acceptance pending'})
            elif scope == 'Fixes':
                if node.tag in {'a', 'li'}:
                    fixes.update(re.findall(r'\bMC-\d+\b', node.text()))
                    if node.tag == 'li' and not re.search(r'\bMC-\d+\b', node.text()):
                        unkeyed += 1
            elif scope and node.tag in {'dt', 'p'}:
                label = clean(node.text())
                parent = node.parent
                nested = False
                while parent and parent is not content:
                    if parent.tag in {'li', 'dd'}:
                        nested = True
                        break
                    parent = parent.parent
                siblings = [n for n in node.parent.children if isinstance(n, Node)]
                at = siblings.index(node)
                next_tag = siblings[at + 1].tag if at + 1 < len(siblings) else None
                if label and len(label) <= 120 and not nested and (node.tag == 'dt' or next_tag in {'ul', 'ol', 'dl'}):
                    topics.append({'section': scope, 'path': [text for _, text in path] + [label],
                                   'kind': 'topic', 'status': 'indexed; acceptance pending'})
        assert fixes, 'No fix IDs found for ' + version
        assert all(t['section'] in {'Additions', 'Changes', 'Experimental', 'Fixes'} for t in topics)
        releases.append({'version': version,
                         'source': 'https://minecraft.wiki/w/Java_Edition_' + version,
                         'retrievedOn': '2026-11-06', 'method': 'curl', 'httpStatus': 200,
                         'htmlSha256': hashlib.sha256(raw).hexdigest(), 'htmlBytes': len(raw),
                         'coverage': 'Section/topic index and issue references; not implementation or acceptance.',
                         'topics': topics, 'unkeyedFixListItems': unkeyed, 'fixIds': sorted(fixes, key=lambda s: int(s[3:]))})
    return {'schemaVersion': 1, 'target': '1.20.6', 'fullParity': False,
            'attribution': 'Historical Minecraft Wiki pages linked per release; article prose stays in ignored cache.',
            'releases': releases}


if __name__ == '__main__':
    result = index(Path(sys.argv[1]))
    Path(sys.argv[2]).write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    for release in result['releases']:
        print(release['version'], len(release['topics']), 'topic/section entries,', len(release['fixIds']), 'fix references')
