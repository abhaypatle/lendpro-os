import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      app_title: "DevMan LendPro OS",
      admin_panel: "Admin Panel",
      api_keys: "API Keys",
      loan_amount: "Loan Amount",
      due_date: "Due Date",
      pay_via_upi: "Scan & Pay via UPI",
      cash_collected: "Cash Collected",
      receipt_slip: "Repayment Voucher",
      agent_wallet: "Agent Cash in Hand",
      generate_key: "Generate API Key",
      select_language: "Language"
    }
  },
  hi: {
    translation: {
      app_title: "देवमैन लेंडप्रो ओएस",
      admin_panel: "व्यवस्थापक पैनल",
      api_keys: "एपीआई कुंजियाँ",
      loan_amount: "ऋण राशि",
      due_date: "देय तिथि",
      pay_via_upi: "यूपीआई से भुगतान करें",
      cash_collected: "नकद प्राप्त हुआ",
      receipt_slip: "पावती / रसीद",
      agent_wallet: "एजेंट रोकड़ शेष",
      generate_key: "एपीआई की बनाएं",
      select_language: "भाषा"
    }
  },
  mr: {
    translation: {
      app_title: "देवमॅन लेंडप्रो ओएस",
      admin_panel: "प्रशासक पॅनेल",
      api_keys: "एपीआय कीज",
      loan_amount: "कर्जाची रक्कम",
      due_date: "देय तारीख",
      pay_via_upi: "यूपीआयने भरा",
      cash_collected: "रोख रक्कम जमा",
      receipt_slip: "परतफेड पावती",
      agent_wallet: "एजंट रोख शिल्लक",
      generate_key: "एपीआय की तयार करा",
      select_language: "भाषा"
    }
  },
  hi_en: {
    translation: {
      app_title: "DevMan LendPro OS",
      admin_panel: "Admin Dashboard",
      api_keys: "API Keys Manage",
      loan_amount: "Loan Mool-dhan",
      due_date: "Kist ki Aakhri Date",
      pay_via_upi: "UPI QR Scan karke Pay karein",
      cash_collected: "Cash jama hua",
      receipt_slip: "Payment Paavti Slip",
      agent_wallet: "Agent ke paas jama Cash",
      generate_key: "Nayi API Key banayein",
      select_language: "Language Chunein"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
