import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AppState {
  theme: 'light' | 'dark';
  language: 'en' | 'zh-CN';
  loading: boolean;
}

const initialState: AppState = {
  theme: 'light',
  language: 'en',
  loading: false,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<AppState['theme']>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<AppState['language']>) => {
      state.language = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setTheme, setLanguage, setLoading } = appSlice.actions;
export default appSlice.reducer;

