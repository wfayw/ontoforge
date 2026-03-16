import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Input, Button, Typography, Empty, Spin, Skeleton } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { aipApi } from '@/services/api';

const { Text } = Typography;

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface Props {
  agentId?: string;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
}

const AgentChatWidget = memo(function AgentChatWidget({
  agentId,
  loading: externalLoading = false,
  placeholder = 'Ask a question...',
  emptyText = 'Start chatting',
}: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !agentId) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setSending(true);

    try {
      const resp = await aipApi.chatStream({ agent_id: agentId, conversation_id: conversationId, message: text });
      if (!resp.body) throw new Error('No stream');

      const assistantIdx = messages.length + 1;
      setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let contentBuf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            if (chunk.type === 'conversation_id') {
              setConversationId(chunk.conversation_id);
            } else if (chunk.type === 'content_delta') {
              contentBuf += chunk.content;
              const snap = contentBuf;
              setMessages(prev => prev.map((m, i) =>
                i === assistantIdx ? { ...m, content: snap } : m,
              ));
            } else if (chunk.type === 'done') {
              setMessages(prev => prev.map((m, i) =>
                i === assistantIdx ? { ...m, streaming: false } : m,
              ));
            }
          } catch { /* skip parse errors */ }
        }
      }

      setMessages(prev => prev.map((m, i) =>
        i === assistantIdx ? { ...m, streaming: false } : m,
      ));
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: failed to get response.' }]);
    }
    setSending(false);
  }, [input, sending, agentId, conversationId, messages.length]);

  if (externalLoading) {
    return (
      <div style={{ padding: 12 }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    );
  }

  if (!agentId) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No agent configured" />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-quaternary)' }}>
            <RobotOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
            <Text style={{ fontSize: 12, color: 'var(--text-quaternary)' }}>{emptyText}</Text>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 8,
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: 12,
              background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {m.role === 'user'
                ? <UserOutlined style={{ fontSize: 12, color: '#fff' }} />
                : <RobotOutlined style={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              }
            </div>
            <div style={{
              maxWidth: '80%',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.6,
              background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-elevated)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {m.content || (m.streaming ? <Spin size="small" /> : '')}
              {m.streaming && m.content && (
                <span style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: 'var(--primary)', marginLeft: 2,
                  animation: 'blink 1s infinite',
                }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6 }}>
        <Input
          size="small"
          value={input}
          onChange={e => setInput(e.target.value)}
          onPressEnter={handleSend}
          placeholder={placeholder}
          disabled={sending}
          style={{ fontSize: 12 }}
        />
        <Button
          size="small"
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={sending}
          disabled={!input.trim()}
        />
      </div>
    </div>
  );
});

export default AgentChatWidget;
