/**
 * Sample admin dashboard data.
 *
 * NOTE: These are illustrative figures for the v1 demo, since real donations
 * aren't being processed yet. When v2 adds real payments, this file gets
 * replaced by data loaded from your backend/API.
 *
 * The arrays are kept in sync index-by-index between AR and EN.
 */

export type DonationColor = 'green' | 'gold' | 'anon' | 'dark';

export type Donation = {
  name: string;
  location: string;
  amountUSD: number;
  target: string;
  time: string;
  color: DonationColor;
};

export type AlertType = 'warning' | 'info' | 'danger';
export type Alert = {
  type: AlertType;
  title: string;
  meta: string;
  icon: string;
};

export type ActivityColor = 'green' | 'gold' | 'blue';
export type Activity = { color: ActivityColor; text: string; time: string };

export type TopDonor = { name: string; amountUSD: number };

export type WeekDay = { day: string; short: string; amount: number; today: boolean };

// ============================================================
// ARABIC DATA
// ============================================================
export const RECENT_DONATIONS_AR: Donation[] = [
  { name: 'أبو سامر',            location: 'برلين، ألمانيا',     amountUSD: 500,  target: 'إنارة طريق مدرسة الفاروق', time: 'منذ ٣ دقائق',  color: 'green' },
  { name: 'فاطمة الخالد',         location: 'الدوحة، قطر',         amountUSD: 250,  target: 'شبكة المياه — حارة الزيتون', time: 'منذ ٨ دقائق',  color: 'gold'  },
  { name: 'متبرع مجهول',         location: 'الولايات المتحدة',     amountUSD: 1000, target: 'تأهيل شارع الجلاء',         time: 'منذ ١٤ دقيقة', color: 'anon'  },
  { name: 'محمد القاسم',         location: 'دمشق، سوريا',          amountUSD: 75,   target: 'حديقة الأمل المركزية',      time: 'منذ ٢١ دقيقة', color: 'green' },
  { name: 'عائلة الحوراني',       location: 'إسطنبول، تركيا',       amountUSD: 350,  target: 'برج إنترنت — الحي الغربي',  time: 'منذ ٣٧ دقيقة', color: 'dark'  },
  { name: 'سارة العبدالله',       location: 'باريس، فرنسا',         amountUSD: 100,  target: 'إصلاح الصرف الصحي المركزي', time: 'منذ ٤٥ دقيقة', color: 'gold'  },
  { name: 'متبرع مجهول',         location: 'كندا',                  amountUSD: 200,  target: 'المركز الصحي الشمالي',     time: 'منذ ساعة',     color: 'anon'  },
  { name: 'أحمد الزيتوني',        location: 'الرياض، السعودية',     amountUSD: 150,  target: 'بئر ارتوازي للمدارس',        time: 'منذ ساعة',     color: 'green' },
  { name: 'خديجة الشهابي',       location: 'بيروت، لبنان',          amountUSD: 50,   target: 'نقاط واي فاي عامة',          time: 'منذ ساعتين',   color: 'gold'  },
  { name: 'مجموعة أصدقاء داريّا', location: 'مالمو، السويد',         amountUSD: 800,  target: 'ترميم الجامع الكبير',        time: 'منذ ٣ ساعات',  color: 'dark'  },
];

export const ALERTS_AR: Alert[] = [
  { type: 'warning', title: 'مشروع «بئر ارتوازي للمدارس» تم تمويله ٥٪ فقط', meta: 'يحتاج حملة وصول إضافية',         icon: '!' },
  { type: 'info',    title: 'تقرير مالي شهري بانتظار الاعتماد',                meta: 'رفع من قبل أ. ليلى — منذ يومين', icon: 'i' },
  { type: 'info',    title: '٣ متبرعين جدد طلبوا تذاكر ضريبية أمريكية',         meta: 'للسنة المالية ٢٠٢٦',           icon: '$' },
  { type: 'danger',  title: 'مشروع «إعادة رصف شارع الثورة» متأخر عن جدوله',     meta: '٧ أيام تأخير عن البدء',         icon: '×' },
];

export const ACTIVITIES_AR: Activity[] = [
  { color: 'green', text: 'تم رفع تحديث ميداني على مشروع <strong>إصلاح الصرف الصحي المركزي</strong> من قبل م. عبد الرحمن', time: 'منذ ١٠ دقائق' },
  { color: 'gold',  text: 'وصل تبرع كبير بقيمة <strong>$1,000</strong> من متبرع مجهول لشارع الجلاء',                       time: 'منذ ١٤ دقيقة' },
  { color: 'blue',  text: 'تم اعتماد فاتورة شراء الإسفلت بمبلغ <strong>$2,400</strong> من قبل أ. أحمد الخالد',              time: 'منذ ٤٥ دقيقة' },
  { color: 'green', text: 'أُضيف بند فرعي جديد <strong>«ربط مع الشبكة العامة»</strong> لمشروع الصرف الصحي الشرقي',         time: 'منذ ساعتين' },
  { color: 'gold',  text: 'تجاوز عدد المتبرعين لمشروع <strong>الجامع الكبير</strong> الـ ٣٠٠ متبرع',                       time: 'منذ ٣ ساعات' },
  { color: 'blue',  text: 'تم رفع التقرير المالي الأسبوعي إلى صفحة الشفافية',                                              time: 'منذ ٥ ساعات' },
];

export const TOP_DONORS_AR: TopDonor[] = [
  { name: 'مجموعة أصدقاء داريّا — السويد', amountUSD: 4800 },
  { name: 'أبو سامر — برلين',              amountUSD: 3200 },
  { name: 'عائلة الحوراني — إسطنبول',       amountUSD: 2750 },
  { name: 'فاطمة الخالد — الدوحة',          amountUSD: 1900 },
  { name: 'متبرع مجهول — الولايات المتحدة', amountUSD: 1500 },
];

export const WEEK_DATA_AR: WeekDay[] = [
  { day: 'الأحد',    short: 'أحد',  amount: 1240, today: false },
  { day: 'الإثنين',  short: 'إث',   amount: 980,  today: false },
  { day: 'الثلاثاء', short: 'ثلا',  amount: 1820, today: false },
  { day: 'الأربعاء', short: 'أرب',  amount: 2100, today: false },
  { day: 'الخميس',   short: 'خم',   amount: 1450, today: false },
  { day: 'الجمعة',   short: 'جم',   amount: 2680, today: false },
  { day: 'السبت',    short: 'سب',   amount: 1850, today: true  },
];

// ============================================================
// ENGLISH DATA
// ============================================================
export const RECENT_DONATIONS_EN: Donation[] = [
  { name: 'Abu Samer',             location: 'Berlin, Germany',          amountUSD: 500,  target: 'Lighting road to Al-Farouq school', time: '3 minutes ago',  color: 'green' },
  { name: 'Fatima Al-Khaled',      location: 'Doha, Qatar',              amountUSD: 250,  target: 'Water network — Az-Zaytoun',         time: '8 minutes ago',  color: 'gold'  },
  { name: 'Anonymous donor',       location: 'United States',            amountUSD: 1000, target: 'Al-Jalaa Street rehabilitation',     time: '14 minutes ago', color: 'anon'  },
  { name: 'Mohammad Al-Qasem',     location: 'Damascus, Syria',          amountUSD: 75,   target: 'Central Al-Amal Park',               time: '21 minutes ago', color: 'green' },
  { name: 'Al-Hourani Family',     location: 'Istanbul, Turkey',         amountUSD: 350,  target: 'Internet tower — Western District',  time: '37 minutes ago', color: 'dark'  },
  { name: 'Sara Al-Abdullah',      location: 'Paris, France',            amountUSD: 100,  target: 'Central sewer repair',               time: '45 minutes ago', color: 'gold'  },
  { name: 'Anonymous donor',       location: 'Canada',                   amountUSD: 200,  target: 'Northern Health Center',             time: '1 hour ago',     color: 'anon'  },
  { name: 'Ahmad Al-Zaytouni',     location: 'Riyadh, Saudi Arabia',     amountUSD: 150,  target: 'Artesian well for schools',          time: '1 hour ago',     color: 'green' },
  { name: 'Khadija Al-Shihabi',    location: 'Beirut, Lebanon',          amountUSD: 50,   target: 'Public WiFi hotspots',               time: '2 hours ago',    color: 'gold'  },
  { name: 'Darayya Friends Group', location: 'Malmö, Sweden',            amountUSD: 800,  target: 'Grand Mosque restoration',           time: '3 hours ago',    color: 'dark'  },
];

export const ALERTS_EN: Alert[] = [
  { type: 'warning', title: 'Project "Artesian well for schools" is only 5% funded', meta: 'Needs an outreach campaign',          icon: '!' },
  { type: 'info',    title: 'Monthly financial report awaiting approval',             meta: 'Submitted by Ms. Leila — 2 days ago', icon: 'i' },
  { type: 'info',    title: '3 new donors requested US tax receipts',                  meta: 'For fiscal year 2026',                icon: '$' },
  { type: 'danger',  title: 'Project "Al-Thawra Street repaving" is behind schedule',  meta: '7 days delay before start',           icon: '×' },
];

export const ACTIVITIES_EN: Activity[] = [
  { color: 'green', text: 'Field update posted on <strong>Central sewer repair</strong> by Eng. Abdulrahman',     time: '10 minutes ago' },
  { color: 'gold',  text: 'Large donation of <strong>$1,000</strong> received from an anonymous donor for Al-Jalaa Street', time: '14 minutes ago' },
  { color: 'blue',  text: 'Asphalt purchase invoice approved at <strong>$2,400</strong> by Mr. Ahmad Al-Khaled',  time: '45 minutes ago' },
  { color: 'green', text: 'New sub-item <strong>"Connection to main network"</strong> added to Eastern sewer project', time: '2 hours ago' },
  { color: 'gold',  text: 'Number of donors for <strong>Grand Mosque</strong> exceeded 300',                       time: '3 hours ago' },
  { color: 'blue',  text: 'Weekly financial report uploaded to Transparency page',                                 time: '5 hours ago' },
];

export const TOP_DONORS_EN: TopDonor[] = [
  { name: 'Darayya Friends Group — Sweden', amountUSD: 4800 },
  { name: 'Abu Samer — Berlin',              amountUSD: 3200 },
  { name: 'Al-Hourani Family — Istanbul',    amountUSD: 2750 },
  { name: 'Fatima Al-Khaled — Doha',         amountUSD: 1900 },
  { name: 'Anonymous donor — United States', amountUSD: 1500 },
];

export const WEEK_DATA_EN: WeekDay[] = [
  { day: 'Sunday',    short: 'Sun', amount: 1240, today: false },
  { day: 'Monday',    short: 'Mon', amount: 980,  today: false },
  { day: 'Tuesday',   short: 'Tue', amount: 1820, today: false },
  { day: 'Wednesday', short: 'Wed', amount: 2100, today: false },
  { day: 'Thursday',  short: 'Thu', amount: 1450, today: false },
  { day: 'Friday',    short: 'Fri', amount: 2680, today: false },
  { day: 'Saturday',  short: 'Sat', amount: 1850, today: true  },
];

// ============================================================
// Helper to pick the right data array by language
// ============================================================
import type { Lang } from '../i18n/strings';

export function adminData(lang: Lang) {
  return {
    donations:  lang === 'en' ? RECENT_DONATIONS_EN : RECENT_DONATIONS_AR,
    alerts:     lang === 'en' ? ALERTS_EN           : ALERTS_AR,
    activities: lang === 'en' ? ACTIVITIES_EN       : ACTIVITIES_AR,
    topDonors:  lang === 'en' ? TOP_DONORS_EN       : TOP_DONORS_AR,
    weekData:   lang === 'en' ? WEEK_DATA_EN        : WEEK_DATA_AR,
  };
}
