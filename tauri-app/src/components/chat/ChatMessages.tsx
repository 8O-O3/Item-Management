import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';

export default function ChatMessages() {
  const messages = useChatStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="p-4 space-y-4">
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function ChatMessage({ message }: { message: { role: string; content: string } }) {
  const isUser = message.role === 'user';
  const isStreaming = message.role === 'assistant-streaming';

  // Simple markdown-like formatting
  const formatted = formatContent(message.content);

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">AI</div>
      )}
      <div className={`max-w-[85%]`}>
        <div className={`text-[10px] font-semibold mb-1 ${isUser ? 'text-right text-text-secondary' : 'text-accent'}`}>
          {isUser ? 'You' : isStreaming ? 'AI •••' : 'AI'}
        </div>
        <div
          className={`text-sm leading-relaxed rounded-2xl px-4 py-2.5 ${
            isUser
              ? 'bg-accent text-white rounded-br-md shadow-sm'
              : 'bg-surface text-text rounded-bl-md border border-border'
          } ${isStreaming ? 'ring-1 ring-accent/20' : ''}`}
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      </div>
    </div>
  );
}

function formatContent(text: string): string {
  if (!text) return '';
  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-bg rounded-lg p-3 my-2 text-xs overflow-x-auto"><code>$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-bg px-1 py-0.5 rounded text-xs">$1</code>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // List items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // Newlines
  html = html.replace(/\n\n/g, '</p><p class="mt-2">');
  html = html.replace(/\n/g, '<br>');
  return '<p>' + html + '</p>';
}
