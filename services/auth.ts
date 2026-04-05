import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
const AUTH_TOKEN_KEY = "auth_token";

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function getToken() {
  return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Registration failed: ${errorText}`);
  }

  const data: AuthResponse = await response.json();
  await setToken(data.token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Login failed: ${errorText}`);
  }

  const data: AuthResponse = await response.json();
  await setToken(data.token);
  return data;
}

export async function logout() {
  await removeToken();
}

export async function isLoggedIn() {
  const token = await getToken();
  return !!token;
}
