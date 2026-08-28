import { supabase } from '@/lib/supabase';

export type LegalKey = 'privacy' | 'terms' | 'licenses';

export interface LegalDocument {
  key: LegalKey;
  title: string;
  content: string;
  updated_at: string;
}

const DEFAULT_DOCUMENTS: Record<LegalKey, { title: string; content: string }> = {
  privacy: {
    title: 'Privacy Policy',
    content: `# Privacy Policy

**Last Updated: August 2026**

Sync Guardian is designed with strict privacy principles to help parents monitor notification activity on their family's devices securely.

### 1. Data Collection & Purpose
- **Notification Mirroring**: We process notification metadata (app name, title, text, timestamp) exclusively to mirror alerts to paired parental accounts.
- **End-to-End Encryption**: All mirrored notification payloads are encrypted at rest using AES-256-GCM with keys unique to each device pair.
- **Device Health & Presence**: We collect basic device state (battery level, connectivity status, last active timestamp) to ensure reliable monitoring.

### 2. Information Sharing
- We **never sell, rent, or monetize** your personal data or notification contents.
- Data is strictly accessible only by authenticated members of your paired guardian network.

### 3. Data Retention & Deletion
- Notification history is retained according to your active subscription period (30 to 90 days).
- You can revoke a device pair or clear cached notifications at any time from **Privacy & Security** settings, which permanently purges associated mirrored data.

### 4. Contact & Support
If you have questions about this policy or wish to exercise data rights, please contact our support team at **support@syncguardian.app**.`,
  },
  terms: {
    title: 'Terms of Service',
    content: `# Terms of Service

**Last Updated: August 2026**

Welcome to Sync Guardian. By creating an account or using our services, you agree to these Terms of Service.

### 1. Authorized Parental Use
- Sync Guardian is intended strictly for parents and legal guardians monitoring devices belonging to their minor children or dependents with lawful authorization.
- Unauthorized surveillance or installation on devices without legal consent is strictly prohibited and constitutes grounds for immediate account termination.

### 2. Account Security
- You are responsible for safeguarding your login credentials and QR pairing codes.
- Do not share pairing tokens or session keys with unauthorized third parties.

### 3. Subscriptions & Billing
- Subscriptions provide access to real-time notification mirroring, extended history, and family device slots.
- Subscriptions recur automatically through supported payment methods (such as UPI AutoPay) until cancelled. You may cancel anytime from the subscription management screen.

### 4. Service Availability
- While we strive for 99.9% uptime, push notification delivery may depend on third-party mobile operating systems, battery optimization settings, and internet connectivity.

### 5. Limitation of Liability
- Sync Guardian is provided on an "as is" and "as available" basis. We disclaim liability for indirect or consequential damages arising from service interruptions.`,
  },
  licenses: {
    title: 'Open-Source Licenses',
    content: `# Open-Source Licenses

Sync Guardian is built using open-source software:

- **React & React Native**: MIT License
- **Expo Framework**: MIT License
- **Supabase Client**: MIT License
- **Lucide / Expo Vector Icons**: MIT License / SIL OFL
- **Reanimated & Gesture Handler**: MIT License

We are grateful to the open-source community for making this application possible.`,
  },
};

export async function getLegalDocument(key: LegalKey): Promise<LegalDocument> {
  try {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('key, title, content, updated_at')
      .eq('key', key)
      .single();
    if (!error && data) {
      return data as LegalDocument;
    }
  } catch {}

  const fallback = DEFAULT_DOCUMENTS[key] || DEFAULT_DOCUMENTS.privacy;
  return {
    key,
    title: fallback.title,
    content: fallback.content,
    updated_at: new Date().toISOString(),
  };
}
