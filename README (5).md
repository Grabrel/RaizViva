# Funções compartilhadas

Este diretório contém utilitários usados pelas Edge Functions do Nervi.

Segredos necessários no Supabase:

- `NERVI_OTP_PEPPER`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN` (ou `TWILIO_API_KEY` + `TWILIO_API_SECRET`)
- `TWILIO_FROM` **ou** `TWILIO_MESSAGING_SERVICE_SID`

Nunca coloque esses valores no frontend ou no GitHub.
