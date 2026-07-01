import os
import re

def find_stray_text_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Simple regex to strip JSX comments {/* ... */}
    content_clean = re.sub(r'\{\/\*.*?\*\/\s*\}', '', content, flags=re.DOTALL)

    errors = []
    
    # We want to identify open tags of Views: View, ScrollView, SafeAreaView, TouchableOpacity, Pressable, PressableScale, Animated.View, Card
    view_tags = {'View', 'ScrollView', 'SafeAreaView', 'TouchableOpacity', 'Pressable', 'PressableScale', 'Animated.View', 'Card'}
    
    tokens = re.finditer(r'(?P<comment>\{\/\*.*?\*\/\})|(?P<brace>\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(?P<tag></?[a-zA-Z0-9_\.]+(?:\s+[a-zA-Z0-9_-]+(=(?:"[^"]*"|\'[^\']*\'|\{[^{}]*\}))?)*\s*/?>)|(?P<text>[^<{}]+)', content_clean, re.DOTALL)
    
    stack = []
    for match in tokens:
        d = match.groupdict()
        start = match.start()
        # Find line number
        line_no = content_clean[:start].count('\n') + 1
        
        if d['tag']:
            tag_str = d['tag']
            tag_name_match = re.match(r'^</?([a-zA-Z0-9_\.]+)', tag_str)
            if not tag_name_match:
                continue
            tag_name = tag_name_match.group(1)
            
            is_close = tag_str.startswith('</')
            is_self_closing = tag_str.endswith('/>')
            
            if is_close:
                if stack and stack[-1] == tag_name:
                    stack.pop()
            elif not is_self_closing:
                stack.append(tag_name)
                
        elif d['text']:
            text = d['text']
            if stack and stack[-1] in view_tags:
                clean_text = text.strip()
                if clean_text and any(c.isalpha() or c in '.,:;!?-' for c in clean_text):
                    if not (clean_text.startswith('import ') or clean_text.startswith('export ') or clean_text.startswith('const ') or clean_text.startswith('function ')):
                        if len(stack) > 0:
                            lines = content_clean.split('\n')
                            line_content = lines[line_no - 1] if line_no - 1 < len(lines) else ''
                            errors.append((line_no, clean_text, line_content, list(stack)))
                            
    return errors

def main():
    root_dir = '.'
    all_errors = {}
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in root or '.expo' in root or '.git' in root:
            continue
        for file in files:
            if file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                errors = find_stray_text_in_file(filepath)
                if errors:
                    all_errors[filepath] = errors
                    
    for filepath, errors in all_errors.items():
        print(f"File: {filepath}")
        for line_no, text, line, stack in errors:
            print(f"  Line {line_no}: '{text}' (Stack: {stack})")
            print(f"    Code: {line.strip()}")
        print("-" * 50)

if __name__ == '__main__':
    main()
