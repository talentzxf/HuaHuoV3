import React from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalOutlined } from '@ant-design/icons';
import { Dropdown, Button } from 'antd';
import type { MenuProps } from 'antd';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const items: MenuProps['items'] = [
    {
      key: 'en',
      label: 'English',
      onClick: () => handleLanguageChange('en'),
    },
    {
      key: 'zh',
      label: '中文',
      onClick: () => handleLanguageChange('zh'),
    },
  ];

  const getCurrentLanguageLabel = () => {
    return i18n.language === 'zh' ? '中文' : 'EN';
  };

  return (
    <Dropdown menu={{ items, selectedKeys: [i18n.language] }} placement="bottomRight">
      <Button
        type="text"
        icon={<GlobalOutlined />}
        className="main-menu-button"
        style={{ color: 'rgba(255, 255, 255, 0.85)' }}
      >
        {getCurrentLanguageLabel()}
      </Button>
    </Dropdown>
  );
};

export default LanguageSwitcher;

