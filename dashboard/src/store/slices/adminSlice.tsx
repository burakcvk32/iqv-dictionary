import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Admin } from '../../interfaces/models/admin';

export type AdminState = Admin | null;

const initialState: AdminState = null;

export const adminSlice = createSlice({
  name: 'admin',
  initialState: initialState as AdminState,
  reducers: {
    login: (state, action: PayloadAction<Admin>) => {
      state = action.payload;

      return state;
    },
    logout: (state) => {
      state = null;

      return state;
    },
  },
});

export const { login, logout } = adminSlice.actions;

export default adminSlice.reducer;
