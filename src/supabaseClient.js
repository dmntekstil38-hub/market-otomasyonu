import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://odyrnbybxfauotoviabi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TXgWXQT9BoJ1i2EybvbLIQ_r_CjJZZm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);