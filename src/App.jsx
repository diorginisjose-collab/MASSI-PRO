

Saltar para o conteúdo
A utilizar Gmail com leitores de ecrã
1 de 18
import React, { useState, useEffect, useCallback, useRef } from "react"; import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts"; import logoImg from "./assets/logo.png"; // --------------------------------------------------------------- // Compatibilidade: window.storage só existe dentro do ambiente do // Claude. Fora dele (ex: app publicado na Vercel), esse polyfill // usa o localStorage do próprio navegador pra guardar os dados. // --------------------------------------------------------------- if (typeof window !== "undefined" && !window.storage) { window.storage = { async get(key) { const value = window.localStorage.getItem(key); if (value === null) throw new Error("chave não encontrada: " + key); return { key, value }; }, async set(key, value) { window.localStorage.setItem(key, value); return { key, value }; }, async delete(key) { window.localStorage.removeItem(key); 
Caixa de entrada

Diorginis jose Dio <diorginis.jose@gmail.com>
00:15 (há 3 minutos)
para mim

