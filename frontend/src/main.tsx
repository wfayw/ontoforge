import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/theme';
import { I18nProvider } from '@/i18n';
import AntdLocaleWrapper from '@/components/AntdLocaleWrapper';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <AntdLocaleWrapper>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AntdLocaleWrapper>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
