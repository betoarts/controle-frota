# NBAPARK Fleet Control 🚗📊

Aplicação de controle de frota desenvolvida para a NBAPARK, permitindo o gerenciamento eficiente do uso de veículos, quilometragem e itinerários. O sistema inclui recursos de análise inteligente com IA, histórico de viagens e suporte a PWA.

## 📋 Funcionalidades Principais

- **Dashboard Inteligente via IA**: Resumos semanais e análises de frota gerados automaticamente pelo Google Gemini, oferecendo insights sobre o uso dos veículos.
- **Controle de Saídas e Chegadas**:
  - Registro rápido de novas viagens com seleção de veículo, odômetro inicial e itinerário.
  - Encerramento de viagens com validação de quilometragem e cálculo automático de distância/duração.
- **Monitoramento em Tempo Real**: Visualização de viagens ativas globais (quem está usando qual veículo no momento).
- **To-Do List Integrado** ✅:
  - Gerenciamento completo de tarefas com persistência local.
  - Filtros por status, prioridades visuais e dashboard de estatísticas.
  - Calendário integrado para visualização de prazos.
- **Splash Screen Dinâmica** 🎬: Tela de abertura com suporte a vídeo/GIF para uma experiência de usuário imersiva.
- **Histórico Completo**:
  - Histórico individual de viagens do usuário.
  - **Importação e Exportação CSV**: Facilidade para backup e relatórios externos.
- **Agendamento**: Funcionalidade para reservar veículos antecipadamente (SchedulePage).
- **Interface Premium**: Design moderno com animações suaves, logo integrada e navegação intuitiva.
- **Autenticação**: Sistema de login integrado com persistência de sessão.
- **Integração Webhook**: Notificações automáticas de início e fim de viagens para sistemas externos.
- **PWA (Progressive Web App)**: Pode ser instalado como aplicativo nativo em dispositivos móveis e desktop.

## 🚀 Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Vite
- **Estilização**: Tailwind CSS (Design personalizado NBAPARK)
- **Backend / BaaS**: Supabase (Banco de Dados, Autenticação)
- **Inteligência Artificial**: Google Gemini AI (@google/genai)
- **Ícones**: FontAwesome
- **Build/Tooling**: Vite Plugin PWA

## 📂 Estrutura do Projeto

```
nbapark-frota/
├── src/
│   ├── components/      # Componentes de UI (Layout, Login, Forms)
│   ├── lib/             # Configurações de bibliotecas (Supabase)
│   ├── services/        # Lógica de negócios (UserService, GeminiService, Webhook)
│   ├── App.tsx          # Componente principal e roteamento
│   └── types.ts         # Definições de tipos TypeScript
├── public/              # Assets estáticos
└── ...config files      # Configurações (Vite, Tailwind, TypeScript)
```

## 🛠️ Instalação e Configuração

### Pré-requisitos

- Node.js (v18 ou superior)
- Gerenciador de pacotes (npm, yarn ou pnpm)

### Passo a Passo

1.  **Clone o repositório**

    ```bash
    git clone https://github.com/betoarts/controle-frota.git
    cd nbapark-frota
    ```

2.  **Instale as dependências**

    ```bash
    npm install
    ```

3.  **Configuração de Variáveis de Ambiente**
    Crie um arquivo `.env.local` na raiz do projeto com as chaves necessárias (baseado no `.env.example` se existir, ou solicite ao administrador):

    ```env
    VITE_SUPABASE_URL=sua_url_supabase
    VITE_SUPABASE_ANON_KEY=sua_chave_anonima
    VITE_GEMINI_API_KEY=sua_chave_gemini
    # Outras variaveis conforme necessario
    ```

4.  **Rodar Localmente**
    ```bash
    npm run dev
    ```
    O aplicativo estará disponível (geralmente) em `http://localhost:5173`.

## 📦 Build para Produção

Para gerar a versão otimizada para produção:

```bash
npm run build
```

Para visualizar o build localmente:

```bash
npm run preview
```

## 📱 Suporte PWA

Este projeto está configurado como um PWA. Para garantir o funcionamento correto offline e a instalação:

1.  Certifique-se de que o aplicativo está sendo servido via **HTTPS** em produção.
2.  O manifesto (`manifest.webmanifest`) e o Service Worker são gerados automaticamente durante o build.

---

Desenvolvido para **NBAPARK** 🏀
