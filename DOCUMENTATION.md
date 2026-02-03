# DOCUMENTAÇÃO TÉCNICA - NBAPARK Fleet Control

## 1. Visão Geral

O **NBAPARK Fleet Control** é uma solução moderna para gestão de frotas, focada em simplicidade, eficiência e inteligência. Construído como uma aplicação web progressiva (PWA), permite que motoristas registrem saídas e chegadas em tempo real, enquanto gestores acompanham o uso da frota através de análises potencializadas por Inteligência Artificial.

## 2. Arquitetura do Sistema

### 2.1. Tecnologias Core

- **Frontend**: React 19 com TypeScript.
- **Build Tool**: Vite para carregamento rápido e otimização.
- **Estilização**: Tailwind CSS com tema personalizado (Paleta NBA: Azul #1D428A e Vermelho #C8102E).
- **Backend as a Service (BaaS)**: Supabase para banco de Dados (PostgreSQL) e autenticação.
- **Inteligência Artificial**: Google Gemini API via SDK `@google/genai`.

### 2.2. Estrutura de Diretórios

- `/src/components`: Componentes de UI modulares (Dashboard, Login, Forms).
- `/src/services`: Lógica de interface com APIs externas e regras de negócio.
- `/src/lib`: Configurações de instâncias (Supabase client).
- `/src/types.ts`: Definições globais de interfaces TypeScript.
- `/supabase_schema.sql`: Definição das tabelas e políticas RLS.

## 3. Módulos e Funcionalidades

### 3.1. Gestão de Viagens (`userService.ts`)

Responsável pelo ciclo de vida das reservas de veículos.

- `createReservation`: Insere uma nova viagem com status `active`.
- `updateReservation`: Atualiza a viagem com KM final e status `completed`.
- `getActiveReservations`: Monitoramento global de quem está em rota.

### 3.2. Inteligência de Frota (`tipsService.ts` / `geminiService.ts`)

Integração com o modelo Gemini da Google para:

- **Resumo Semanal**: Agrega dados de viagens passadas para identificar padrões de uso.
- **Análise de Itinerário**: Oferece feedback instantâneo sobre a rota e objetivo da viagem.

### 3.3. Administração (`adminService.ts`)

Funcionalidades restritas para controle da frota:

- **Bloqueio de Veículos**: Impede que novos registros sejam iniciados em veículos específicos por motivos de manutenção ou reserva administrativa.
- **Status Global**: Dashboard consolidado de métricas de uso.

### 3.4. Gestão de Tarefas (`TodoList.tsx`)

Módulo independente para organização de tarefas da equipe:

- Persistência local e estados de prioridade (Baixa, Média, Alta).
- Dashboard de produtividade integrado.

## 4. Banco de Dados (Supabase)

Tabelas principais:

- `users`: Armazena dados dos colaboradores e permissões.
- `reservations`: Histórico completo de KMs, datas, itinerários e status.
- `vehicle_status`: Controle dinâmico de disponibilidade dos veículos.
- `user_logs`: Log de auditoria para ações críticas no sistema.

## 5. Integrações Externas

### 5.1. Webhooks (`webhookService.ts`)

O sistema dispara notificações via POST para endpoints configurados nos eventos:

- `trip_start`: Quando um motorista inicia uma viagem.
- `trip_end`: Quando o KM final é registrado.

### 5.2. Google Gemini

Requer a chave `VITE_GEMINI_API_KEY` para processar prompts de análise de dados.

## 6. Fluxo de Publicação e PWA

- **Service Workers**: Gerenciados pelo `vite-plugin-pwa` para suporte offline.
- **Manifest**: Define ícones e cores para instalação como aplicativo nativo (iOS/Android).
