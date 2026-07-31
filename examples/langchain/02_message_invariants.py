from dataclasses import dataclass, field
@dataclass
class Message:
    type: str; content: list[dict]; metadata: dict = field(default_factory=dict)
    @property
    def text(self): return ''.join(x['text'] for x in self.content if x.get('type') == 'text')
a = Message('human', [{'type':'text','text':'hi'}]); b = Message('human', [])
a.metadata['trace']='a'; assert b.metadata == {} and a.text == 'hi'
print('invariants passed')
