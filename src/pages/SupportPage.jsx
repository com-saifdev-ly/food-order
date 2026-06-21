import PageShell from '../components/PageShell';
import { translations } from '../lib/i18n';

export default function SupportPage({ language }) {
  const copy = translations[language];

  return (
    <PageShell language={language}>
      <section className="Hero-card Support-card">

        <h1>{copy.supportTitle}</h1>
        <p className="Support-description">{copy.supportDescription}</p>

        <div className="Support-email-large">
          <div className="Support-email-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"/>
            </svg>
          </div>
          <div className="Support-email-details">
            <p className="Support-email-label">{copy.emailLabel}</p>
            <a 
              href={`mailto:${copy.supportEmail}`} 
              className="Support-email-link-large"
            >
              {copy.supportEmail}
            </a>
            <p className="Support-email-instructions">
              {language === 'ar' 
                ? 'انقر فوق البريد الإلكتروني أعلاه لإرسال رسالة إلينا مباشرة' 
                : 'Click the email above to send us a message directly'}
            </p>
          </div>
        </div>

        <div className="Support-info">
          <h3>{language === 'ar' ? 'معلومات الاتصال' : 'Contact Information'}</h3>
          <p>{language === 'ar' 
            ? 'نحن هنا للمساعدة! إذا كان لديك أي أسئلة أو تحتاج إلى مساعدة مع طلباتك أو حسابك، فلا تتردد في الاتصال بنا.'
            : 'We\'re here to help! If you have any questions or need assistance with your orders or account, please don\'t hesitate to reach out.'}
          </p>
          <div className="Support-hours">
            <p><strong>{language === 'ar' ? 'استجابة سريعة' : 'Quick Response'}:</strong></p>
            <p>{language === 'ar' 
              ? 'نحاول الرد على جميع الاستفسارات في غضون 24 ساعة'
              : 'We aim to respond to all inquiries within 24 hours'}
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
