import { ReactNode } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const antdLocales = { en: enUS, zh: zhCN };

export default function AntdLocaleWrapper({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const { isDark } = useTheme();

  return (
    <ConfigProvider
      locale={antdLocales[locale]}
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#0078D4',
          borderRadius: 6,
          fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          ...(isDark
            ? {
                colorBgContainer: '#262626',
                colorBgElevated: '#303030',
                colorBgLayout: '#1B1B1B',
                colorBorder: 'rgba(255,255,255,0.08)',
                colorBorderSecondary: 'rgba(255,255,255,0.05)',
                colorSplit: 'rgba(255,255,255,0.06)',
              }
            : {
                colorBgContainer: '#FFFFFF',
                colorBgElevated: '#FFFFFF',
                colorBgLayout: '#F5F5F5',
                colorBorder: 'rgba(0,0,0,0.09)',
                colorBorderSecondary: 'rgba(0,0,0,0.05)',
                colorSplit: 'rgba(0,0,0,0.06)',
              }),
        },
        components: {
          Menu: {
            itemBorderRadius: 6,
            ...(isDark
              ? { darkItemBg: 'transparent', darkSubMenuItemBg: 'transparent' }
              : { itemBg: 'transparent', subMenuItemBg: 'transparent' }),
          },
          Card: {
            borderRadiusLG: 8,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
