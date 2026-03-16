import { memo, useState } from 'react';
import { Button, Popconfirm, message, Skeleton } from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons';

interface Props {
  label: string;
  actionTypeId?: string;
  onExecute: (actionTypeId: string) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  confirmTitle?: string;
  size?: 'small' | 'large';
}

const ActionButtonWidget = memo(function ActionButtonWidget({
  label,
  actionTypeId,
  onExecute,
  loading: externalLoading = false,
  disabled = false,
  confirmTitle = 'Confirm execute?',
  size = 'large',
}: Props) {
  const [executing, setExecuting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (externalLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Skeleton.Button active size={size} />
      </div>
    );
  }

  const handleExecute = async () => {
    if (!actionTypeId) return;
    setExecuting(true);
    try {
      await onExecute(actionTypeId);
      setSuccess(true);
      message.success('Action executed');
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      message.error('Execution failed');
    }
    setExecuting(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Popconfirm
        title={confirmTitle}
        onConfirm={handleExecute}
        disabled={!actionTypeId || disabled}
      >
        <Button
          type="primary"
          size={size}
          icon={success ? <CheckCircleOutlined /> : <ThunderboltOutlined />}
          loading={executing}
          disabled={!actionTypeId || disabled}
          style={{
            borderRadius: 8,
            minWidth: 140,
            transition: 'all 200ms ease',
            ...(success ? { background: '#52c41a', borderColor: '#52c41a' } : {}),
          }}
        >
          {success ? 'Done!' : label}
        </Button>
      </Popconfirm>
    </div>
  );
});

export default ActionButtonWidget;
