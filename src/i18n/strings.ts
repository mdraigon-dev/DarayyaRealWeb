/**
 * Centralized UI strings for the Darayya platform.
 * Keep keys identical across languages; missing EN falls back to AR.
 */

export type Lang = 'ar' | 'en';

export const STRINGS = {
  ar: {
    // Nav
    nav_home: 'الرئيسية',
    nav_projects: 'المشاريع',
    nav_transparency: 'الشفافية',
    nav_admin: 'لوحة المجلس',
    nav_donate: 'تبرّع الآن',
    nav_currency_title: 'تبديل العملة',
    nav_menu: 'قائمة',
    brand_title: 'مَعَاً نَبْنِي داريَّا',
    brand_sub: 'منصة المجلس المحلي لإعادة الإعمار',

    // Home
    hero_eyebrow: 'الجمهورية العربية السورية — المجلس المحلي لمدينة داريّا',
    hero_h1_a: 'مَعَاً نَبْنِي ',
    hero_h1_b: 'داريَّا',
    hero_h1_tag: '،\nحجراً حجراً، حيّاً حيّاً.',
    hero_tag: 'منصةٌ شفافةٌ تُتيح لك أن ترى أين تذهب كل ليرة تتبرّع بها، وأن تختار بنفسك المشروع الذي تريد المساهمة فيه — من تعبيد شارع طفولتك إلى إنارة الطريق المؤدية إلى مدرستك.',
    hero_btn_browse: 'استعرض {n} مشروعاً مفتوحاً ←',
    hero_btn_reports: 'تقارير الشفافية',
    hero_stats_title: '★ الإحصائيات الحيّة',
    hero_stat_raised: 'إجمالي ما تم جمعه',
    hero_stat_target: 'من أصل',
    hero_stat_donors: 'عدد المتبرعين',
    hero_stat_open: 'مشاريع مفتوحة الآن',
    hero_stat_completed: 'مشاريع مكتملة',

    urgent_eyebrow: '★ مشروع يحتاج دعمك الآن',
    urgent_meta: '{pct}٪ فقط من المطلوب • {days} يوماً متبقياً',
    urgent_btn: 'عرض المشروع ←',

    map_eyebrow: '★ خريطة المشاريع',
    map_title: 'المشاريع على خريطة داريّا',
    map_desc: 'استكشف مواقع المشاريع في أحياء داريّا المختلفة. اللون يدلّ على حالة المشروع — اضغط أي علامة لمشاهدة التفاصيل والتبرع.',
    map_legend_title: '★ حالة المشاريع',

    featured_eyebrow: '★ المشاريع البارزة',
    featured_title: 'شاركنا في بناء داريّا اليوم',
    featured_desc: 'مشاريع تحتاج إلى دعمك الآن — كلٌّ منها مقسَّم إلى مشاريع فرعية وبنود تفصيلية، يمكنك أن تختار بدقّة المشروع أو حتى الجزء منه الذي ستساهم فيه.',
    featured_all_btn: 'عرض جميع المشاريع ({n}) ←',

    // Projects page
    projects_eyebrow: '★ كل المشاريع',
    projects_title: 'مشاريع إعادة الإعمار في داريّا',
    projects_desc: 'استعرض جميع المشاريع حسب القطاع أو حسب الحالة.',
    projects_results: 'النتائج:',
    projects_count_label: 'مشروع',
    projects_in_cat: 'في قطاع',
    projects_empty: 'لا توجد مشاريع تطابق الفلاتر المحددة.',

    cat_all: 'الكل',
    cat_roads: 'الطرقات والتعبيد',
    cat_water: 'المياه النظيفة',
    cat_sewer: 'الصرف الصحي',
    cat_lighting: 'الإنارة',
    cat_communications: 'الاتصالات',
    cat_facilities: 'المرافق العامة',

    status_all: 'الكل',
    status_funding: 'مفتوح للتبرع',
    status_active: 'قيد التنفيذ',
    status_completed: 'مكتمل',
    status_planning: 'قيد التخطيط',

    urgent_badge: '★ أكثر ضرورة',
    progress_of: 'من',
    progress_donor: 'متبرع',
    progress_donors: 'متبرع',
    days_remaining: 'يوماً متبقياً',

    // Detail page
    breadcrumb_home: 'الرئيسية',
    breadcrumb_projects: 'المشاريع',
    hierarchy_title: 'المشاريع الفرعية والبنود التفصيلية',
    hierarchy_collected: 'تم جمع',
    hierarchy_hint: '★ يمكنك التبرع لمشروع كامل، أو لجزءٍ منه — اضغط على أي بند لتختار التبرع له تحديداً.',
    photos_title: 'صور من الميدان',
    photo_caption_credit: 'صورة من الميدان',
    updates_title: 'آخر التحديثات الميدانية',
    donate_title: '★ ساهم في هذا المشروع',
    donate_raised_of: 'تم جمعه من أصل',
    donate_btn: 'تبرّع لهذا المشروع',
    donate_coming_soon: 'التبرع الإلكتروني قريباً — تواصل معنا للمساهمة الآن',

    health_healthy: 'يسير بشكل ممتاز',
    health_warning: 'يحتاج متابعة',
    health_stalled: 'متعثّر',
    health_completed: 'مكتمل',

    photo_status_healthy: '● يسير جيداً',
    photo_status_warning: '● تأخير',
    photo_status_stalled: '● متعثّر',
    photo_status_completed: '● مكتمل',

    // Transparency
    trans_eyebrow: '★ التزامنا الدائم',
    trans_title: 'الشفافية والمساءلة',
    trans_desc: 'كل دولار يدخل المنصة موثَّق، وكل دولار يخرج منها مرفق بإيصالٍ ومرئي للجميع.',
    trans_target_of: 'من',
    trans_target_label: 'مستهدفة',
    trans_donors: 'متبرع من ١٧ دولة حول العالم',
    trans_completed: 'مشروع مكتمل',
    trans_completed_since: 'منذ إطلاق المنصة',

    // Admin dashboard
    admin_welcome: 'أهلاً بك في لوحة المجلس',
    admin_role: 'المجلس المحلي لمدينة داريّا — نظرة عامة على المشاريع والنشاط',
    admin_eyebrow: '★ لوحة المجلس',
    admin_title: 'نظرة عامة على نشاط المنصة',
    admin_desc: 'متابعة حيّة لكل ما يحدث على المنصة: التبرعات، التقدم في المشاريع، التنبيهات والنشاط اليومي.',
    admin_stat_today: 'المحصّل اليوم',
    admin_stat_total: 'إجمالي المحصّل',
    admin_stat_donors: 'إجمالي المتبرعين',
    admin_stat_open: 'مشاريع مفتوحة',
    admin_recent_donations: 'التبرعات الحديثة',
    admin_view_all: 'عرض الكل ←',
    admin_week_chart: 'تبرعات آخر ٧ أيام',
    admin_week_total: 'إجمالي الأسبوع:',
    admin_week_trend: '↑ ١٨٪',
    admin_alerts: 'التنبيهات',
    admin_alerts_new: '{n} جديدة',
    admin_activity: 'سجل النشاط',
    admin_full_log: 'السجل الكامل ←',
    admin_top_donors: 'أكبر المتبرعين هذا الشهر',
    admin_manage: 'إدارة المشاريع',
    admin_manage_desc: 'لتعديل المشاريع وإضافة تحديثات وصور، استخدم لوحة التحرير في {link}.',
    admin_cms_link: 'صفحة الإدارة',
    admin_col_project: 'المشروع',
    admin_col_budget: 'الميزانية',
    admin_col_raised: 'المحصّل',
    admin_col_donors: 'المتبرعون',
    admin_btn_edit: 'تعديل',
    admin_demo_note: '⚠ هذه البيانات تجريبية للعرض. ستُستبدل ببيانات حقيقية عندما تُفعَّل المدفوعات في الإصدار الثاني.',

    // Footer
    footer_brand: 'مَعَاً نَبْنِي داريَّا',
    footer_about: 'منصة المجلس المحلي لمدينة داريّا لإعادة الإعمار بمشاركة المجتمع المحلي وأبناء المدينة في المهجر. نعمل بشفافية كاملة لاستعادة مدينتنا، حجراً حجراً.',
    footer_nav: 'التصفّح',
    footer_contact: 'تواصل',
    footer_council: 'المجلس المحلي لداريّا',
    footer_feedback: 'اقتراحات وملاحظات',
    footer_copyright: '© ٢٠٢٦ المجلس المحلي لمدينة داريّا — الجمهورية العربية السورية',
    footer_design: 'صُمّمت بالهوية البصرية السورية الجديدة',

    // Map popup
    map_popup_funded: '٪ ممولة',
    map_popup_donor: 'متبرع',
    map_popup_view: 'عرض التفاصيل ←',
  },
  en: {
    nav_home: 'Home',
    nav_projects: 'Projects',
    nav_transparency: 'Transparency',
    nav_admin: 'Council Dashboard',
    nav_donate: 'Donate Now',
    nav_currency_title: 'Switch currency',
    nav_menu: 'Menu',
    brand_title: 'Together We Rebuild Darayya',
    brand_sub: 'Local Council Reconstruction Platform',

    hero_eyebrow: 'Syrian Arab Republic — Darayya City Council',
    hero_h1_a: 'Together We Rebuild ',
    hero_h1_b: 'Darayya',
    hero_h1_tag: ',\nstone by stone, neighborhood by neighborhood.',
    hero_tag: 'A transparent platform that lets you see where every dollar you donate goes — and choose for yourself which project to support, from paving the street of your childhood to lighting the road to your school.',
    hero_btn_browse: 'Browse {n} open projects →',
    hero_btn_reports: 'Transparency Reports',
    hero_stats_title: '★ Live Statistics',
    hero_stat_raised: 'Total raised',
    hero_stat_target: 'Out of',
    hero_stat_donors: 'Donors',
    hero_stat_open: 'Open projects',
    hero_stat_completed: 'Completed projects',

    urgent_eyebrow: '★ Project needing your support now',
    urgent_meta: 'Only {pct}% funded • {days} days remaining',
    urgent_btn: 'View project →',

    map_eyebrow: '★ Project Map',
    map_title: 'Projects on the Darayya Map',
    map_desc: 'Explore project locations across Darayya\'s neighborhoods. Color indicates status — tap any marker to view details.',
    map_legend_title: '★ Project Status',

    featured_eyebrow: '★ Featured Projects',
    featured_title: 'Help rebuild Darayya today',
    featured_desc: 'Projects that need your support now — each is broken down into sub-projects and detailed line items.',
    featured_all_btn: 'View all projects ({n}) →',

    projects_eyebrow: '★ All Projects',
    projects_title: 'Darayya Reconstruction Projects',
    projects_desc: 'Browse all projects by sector or by status.',
    projects_results: 'Results:',
    projects_count_label: 'project(s)',
    projects_in_cat: 'in',
    projects_empty: 'No projects match the selected filters.',

    cat_all: 'All',
    cat_roads: 'Roads & Paving',
    cat_water: 'Clean Water',
    cat_sewer: 'Sewage',
    cat_lighting: 'Street Lighting',
    cat_communications: 'Communications',
    cat_facilities: 'Public Facilities',

    status_all: 'All',
    status_funding: 'Open for funding',
    status_active: 'In progress',
    status_completed: 'Completed',
    status_planning: 'Planning',

    urgent_badge: '★ Most needed',
    progress_of: 'of',
    progress_donor: 'donor',
    progress_donors: 'donors',
    days_remaining: 'days remaining',

    breadcrumb_home: 'Home',
    breadcrumb_projects: 'Projects',
    hierarchy_title: 'Sub-projects and detailed items',
    hierarchy_collected: 'raised',
    hierarchy_hint: '★ You can donate to the whole project or just a part of it — click any item to donate to it specifically.',
    photos_title: 'Photos from the Field',
    photo_caption_credit: 'Field photo',
    updates_title: 'Latest Field Updates',
    donate_title: '★ Support this Project',
    donate_raised_of: 'raised out of',
    donate_btn: 'Donate to this project',
    donate_coming_soon: 'Online donations coming soon — contact us to contribute now',

    health_healthy: 'On track',
    health_warning: 'Needs attention',
    health_stalled: 'Stalled',
    health_completed: 'Completed',

    photo_status_healthy: '● Going well',
    photo_status_warning: '● Delayed',
    photo_status_stalled: '● Stalled',
    photo_status_completed: '● Completed',

    trans_eyebrow: '★ Our Ongoing Commitment',
    trans_title: 'Transparency & Accountability',
    trans_desc: 'Every dollar that comes into the platform is documented, and every dollar that goes out has a receipt visible to everyone.',
    trans_target_of: 'of',
    trans_target_label: 'target',
    trans_donors: 'donors from 17 countries around the world',
    trans_completed: 'completed project(s)',
    trans_completed_since: 'since platform launch',

    admin_welcome: 'Welcome to the Council Dashboard',
    admin_role: 'Darayya City Council — Overview of projects and activity',
    admin_eyebrow: '★ Council Dashboard',
    admin_title: 'Platform activity at a glance',
    admin_desc: 'Live overview of everything happening on the platform: donations, project progress, alerts and daily activity.',
    admin_stat_today: 'Today\'s donations',
    admin_stat_total: 'Total raised',
    admin_stat_donors: 'Total donors',
    admin_stat_open: 'Open projects',
    admin_recent_donations: 'Recent Donations',
    admin_view_all: 'View all →',
    admin_week_chart: 'Donations — Last 7 Days',
    admin_week_total: 'Week total:',
    admin_week_trend: '↑ 18%',
    admin_alerts: 'Alerts',
    admin_alerts_new: '{n} new',
    admin_activity: 'Activity Log',
    admin_full_log: 'Full log →',
    admin_top_donors: 'Top Donors This Month',
    admin_manage: 'Project Management',
    admin_manage_desc: 'To edit projects, add updates, and upload photos, use the editor at {link}.',
    admin_cms_link: 'admin page',
    admin_col_project: 'Project',
    admin_col_budget: 'Budget',
    admin_col_raised: 'Raised',
    admin_col_donors: 'Donors',
    admin_btn_edit: 'Edit',
    admin_demo_note: '⚠ This data is illustrative for the demo. It will be replaced with real data when payments are activated in v2.',

    footer_brand: 'Together We Rebuild Darayya',
    footer_about: 'The Darayya City Council\'s platform for reconstruction with participation from the local community and the diaspora. We work with complete transparency to restore our city, stone by stone.',
    footer_nav: 'Navigation',
    footer_contact: 'Contact',
    footer_council: 'Darayya Local Council',
    footer_feedback: 'Suggestions & feedback',
    footer_copyright: '© 2026 Darayya City Council — Syrian Arab Republic',
    footer_design: 'Designed with the New Syrian Visual Identity',

    map_popup_funded: '% funded',
    map_popup_donor: 'donors',
    map_popup_view: 'View details →',
  },
} as const;

export type StringKey = keyof typeof STRINGS.ar;

/**
 * Translate a key with optional variable substitution.
 * Falls back to Arabic if the English string is missing.
 */
export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = (STRINGS[lang] as any)[key] || (STRINGS.ar as any)[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

/**
 * Format a number per language conventions.
 * AR: Arabic-Indic numerals (٢٣)
 * EN: Latin numerals (23)
 */
export function fmtNum(lang: Lang, n: number): string {
  return lang === 'ar' ? n.toLocaleString('ar-EG') : n.toLocaleString('en-US');
}

/**
 * Pick the right localized field from an object that has { ar, en } subfields.
 */
export function loc<T extends { ar: string; en: string }>(lang: Lang, obj: T | undefined): string {
  if (!obj) return '';
  return obj[lang] || obj.ar;
}

/**
 * Format a USD amount. Always uses $ + Latin digits for cleanliness in both languages.
 */
export function fmtUSD(_lang: Lang, n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

/**
 * Format SYP amount. Uses Arabic-Indic in AR, Latin in EN.
 */
export const USD_TO_SYP = 13000;
export function fmtSYP(lang: Lang, usdAmount: number): string {
  const syp = usdAmount * USD_TO_SYP;
  return lang === 'ar' ? `${syp.toLocaleString('ar-EG')} ل.س` : `${syp.toLocaleString('en-US')} SYP`;
}

/**
 * Format an amount in the requested currency.
 */
export function fmtMoney(lang: Lang, currency: 'USD' | 'SYP', usdAmount: number): string {
  return currency === 'USD' ? fmtUSD(lang, usdAmount) : fmtSYP(lang, usdAmount);
}
