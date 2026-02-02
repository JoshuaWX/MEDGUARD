# Bundled Edge Functions

These are standalone versions of the Edge Functions that can be deployed directly via the **Supabase Dashboard** without requiring the Supabase CLI.

## Why Bundled Versions?

The Supabase Dashboard's Edge Function editor **does not support relative imports** to shared modules (like `../_shared/cors.ts`). These bundled versions have all shared code inlined, making them self-contained and deployable via copy-paste.

## Deployment Steps

### 1. Go to Supabase Dashboard
Navigate to: https://supabase.com/dashboard/project/cddfhyxlhtmrrtduwlqd/functions

### 2. Deploy Each Function

For each function (`avatar-sign`, `chat`, `intel`, `verify-location`):

1. Click **"Create a new function"** or edit the existing one
2. Set the function name (must match exactly):
   - `avatar-sign`
   - `chat`
   - `intel`
   - `verify-location`
3. Copy the entire contents of the corresponding `.ts` file from this folder
4. Paste into the Dashboard editor
5. Click **Deploy**

### 3. Verify JWT Settings

Make sure each function has the correct JWT verification setting:
- `avatar-sign`: **JWT verification ON** (requires authentication)
- `chat`: **JWT verification ON** (requires authentication)
- `intel`: **JWT verification OFF** (allows anonymous access)
- `verify-location`: **JWT verification OFF** (allows anonymous access)

### 4. Environment Variables

Ensure these environment variables are set in your Supabase project:

**Required:**
- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_ANON_KEY` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase
- `OPENROUTER_API_KEY` - For chat LLM
- `PINECONE_API_KEY` - For RAG vector search
- `PINECONE_HOST` - Pinecone index host

**Optional:**
- `OPENWEATHER_API_KEY` - For weather/AQI data
- `HF_API_KEY` or `HUGGINGFACE_API_KEY` - For embeddings
- `OPENAI_API_KEY` - Fallback for embeddings

## File Descriptions

### avatar-sign.ts (~100 lines)
Creates signed URLs for avatar storage. Requires authentication.

### chat.ts (~550 lines)
AI chatbot with RAG (Pinecone), intent classification, and LLM fallback chain:
- Primary: Gemma 3 27B
- Fallback 1: LLaMA 3.3 70B
- Fallback 2: Mistral 7B

### intel.ts (~1150 lines)
Weather, AQI, and disease risk assessment. Includes full risk-engine with:
- Health-first AQI calculation (PM2.5 > PM10 > CO > NO₂)
- Disease risk assessment for malaria, cholera, typhoid, meningitis, Lassa fever
- Nigeria state coordinates and regional classification

### verify-location.ts (~130 lines)
Reverse geocoding using Nominatim. Updates user context with location.

## Original Source Files

The source files with proper modular structure are still available in:
- `supabase/functions/avatar-sign/index.ts`
- `supabase/functions/chat/index.ts`
- `supabase/functions/intel/index.ts`
- `supabase/functions/verify-location/index.ts`
- `supabase/functions/_shared/*`

Use the CLI (`supabase functions deploy`) when network issues are resolved for a better development workflow.
