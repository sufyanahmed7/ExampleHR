import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from '../../types';

const stored = localStorage.getItem('auth');
const initial: AuthState = stored
  ? JSON.parse(stored)
  : { user: null, accessToken: null, status: 'idle', error: null };

const authSlice = createSlice({
  name: 'auth',
  initialState: initial,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'succeeded';
      state.error = null;
      localStorage.setItem('auth', JSON.stringify(state));
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'idle';
      state.error = null;
      localStorage.removeItem('auth');
    },
    setError(state, action: PayloadAction<string>) {
      state.status = 'failed';
      state.error = action.payload;
    },
  },
});

export const { setCredentials, logout, setError } = authSlice.actions;
export default authSlice.reducer;
