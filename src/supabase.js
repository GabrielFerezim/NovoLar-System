import { createClient } from '@supabase/supabase-js';

// URL e Chave pública de conexão do Supabase (para uso no Electron/Navegador)
const SUPABASE_URL = 'https://chuxqgcgraxzsvzvtige.supabase.co';
const SUPABASE_KEY = 'sb_publishable_m3b0VQ_NWW3mcm0DU6K6RQ_0pQHUX-8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
