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
    nav_circulars: 'التعاميم والقرارات',
    nav_admin: 'لوحة المجلس',
    nav_donate: 'طريقة المساهمة',
    nav_currency_title: 'تبديل العملة',
    nav_menu: 'قائمة',
    brand_title: 'نماء | Namaa',
    brand_sub: 'منصة مجلس المدينة لإعادة الإعمار',

    // Home
    hero_eyebrow: 'الجمهورية العربية السورية — مجلس مدينة داريّا',
    hero_h1_a: 'مَعَاً نَبْنِي ',
    hero_h1_b: 'داريَّا',
    hero_h1_tag: '،\nحجراً حجراً، حيّاً حيّاً.',
    hero_tag: 'منصةٌ شفافةٌ تتابع من خلالها مشاريع إعادة إعمار داريّا خطوةً بخطوة: ما يُنجَز على الأرض، وما جُمِع لكل مشروع، وأين يُصرَف. تُجمَع المساهمات عبر لجنة التنمية في المدينة وتُسلَّم إلى مجلس المدينة، ويُنشَر كل تقدّم هنا — من تعبيد شارع طفولتك إلى إنارة الطريق المؤدية إلى مدرستك.',
    hero_btn_browse: 'استعرض {n} مشروعاً مفتوحاً ←',
    hero_btn_reports: 'تقارير الشفافية',
    hero_stats_title: '★ الإحصائيات الحيّة',
    hero_stat_raised: 'إجمالي ما تم جمعه',
    hero_stat_target: 'من أصل',
    hero_stat_open: 'مشاريع مفتوحة الآن',
    hero_stat_completed: 'مشاريع مكتملة',

    urgent_eyebrow: '★ مشروع يحتاج دعمك الآن',
    urgent_meta: '{pct}٪ فقط من المطلوب • {days} يوماً متبقياً',
    urgent_btn: 'عرض المشروع ←',

    map_eyebrow: '★ خريطة المشاريع',
    map_title: 'المشاريع على خريطة داريّا',
    map_desc: 'استكشف مواقع المشاريع في أحياء داريّا المختلفة. اللون يدلّ على حالة المشروع — اضغط أي علامة لمشاهدة التفاصيل.',
    map_legend_title: '★ حالة المشاريع',

    featured_eyebrow: '★ المشاريع البارزة',
    featured_title: 'شاركنا في بناء داريّا اليوم',
    featured_desc: 'مشاريع تحتاج إلى دعمك الآن — كلٌّ منها مقسَّم إلى مشاريع فرعية وبنود تفصيلية.',
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
    status_funding: 'مفتوح للتمويل',
    status_active: 'قيد التنفيذ',
    status_completed: 'مكتمل',
    status_planning: 'قيد التخطيط',

    urgent_badge: '★ أكثر ضرورة',
    progress_of: 'من',
    days_remaining: 'يوماً متبقياً',
    deadline_today: 'آخر يوم للتمويل اليوم',

    // Activity log (home + dashboard)
    activity_recent: 'النشاط الأخير',
    activity_log_title: 'سجلّ النشاط',
    activity_log_desc: 'كل ما يجري في المشاريع والوثائق، الأحدث أولاً، مع وقت كل نشاط.',
    activity_kind_update: 'تحديث ميداني',
    activity_kind_note: 'ملاحظة',
    activity_kind_photo: 'صورة جديدة',
    activity_kind_funds: 'مساهمة مسجّلة',
    activity_kind_document: 'وثيقة',
    activity_filter_all: 'الكل',
    activity_filter_label: 'تصفية حسب النوع',
    activity_by: 'بواسطة {name}',
    activity_recorded_by: 'سجّلها {name}',
    activity_show_more: 'عرض المزيد ({n} متبقٍّ)',
    activity_empty: 'لا يوجد نشاط بعد. ستظهر هنا التحديثات والملاحظات والمساهمات والوثائق الجديدة.',
    activity_del_funds_warning: 'سيُخصم {amount} من تمويل المشروع أيضاً.',
    activity_del_doc_warning: 'سيُحذف الملف المرفق أيضاً.',
    activity_deleted_toast: 'تم الحذف. يرى الجميع التغيير بعد إعادة بناء الموقع (١–٣ دقائق).',
    // Council dashboard — figures computed from recorded data only
    dash_tile_funded: 'المموَّل حتى الآن',
    dash_tile_funded_sub: 'من أصل {budget} · {pct}٪',
    dash_tile_gap: 'التمويل المتبقّي المطلوب',
    dash_tile_gap_sub: 'لـ {n} مشروعاً لم يكتمل تمويلها',
    dash_tile_projects: 'المشاريع',
    dash_tile_projects_sub: '{open} مفتوح للتمويل · {active} قيد التنفيذ · {done} مكتمل',
    dash_tile_recorded: 'مساهمات سُجِّلت عبر الموقع',
    dash_tile_recorded_sub: '{n} مساهمة · آخر ٣٠ يوماً: {recent}',
    dash_tile_recorded_none: 'لم تُسجَّل أي مساهمة عبر الموقع بعد',
    dash_tile_attention: 'تحتاج متابعة',
    dash_tile_attention_sub: 'مشاريع فيها ما يستدعي التدخّل',
    dash_sectors_title: 'التمويل حسب القطاع',
    dash_sectors_desc: 'مرتّبة حسب المبلغ المتبقّي — الأكثر حاجةً أولاً.',
    dash_sector_needed: 'متبقٍّ {gap}',
    dash_attention_title: 'مشاريع تحتاج متابعة',
    dash_attention_none: 'لا شيء يستدعي المتابعة الآن.',
    dash_reason_stalled: 'متعثّر',
    dash_reason_warning: 'حالته: يحتاج متابعة',
    dash_reason_deadline: 'انتهى موعد التمويل قبل اكتماله',
    dash_reason_funded_open: 'مموَّل بالكامل لكنه ما زال «مفتوحاً للتمويل» — حدّث الحالة',
    dash_reason_completed_unfunded: 'مسجَّل كمكتمل لكن تمويله {pct}٪ فقط',
    dash_reason_stale: 'لا تحديث منذ {days} يوماً',
    dash_reason_never: 'لم يُنشر أي تحديث بعد',
    dash_show_all: 'عرض الكل ({n})',
    dash_col_last_update: 'آخر تحديث',
    dash_sort_stale: 'الأقدم تحديثاً',

    // Detail page
    breadcrumb_home: 'الرئيسية',
    breadcrumb_projects: 'المشاريع',
    hierarchy_title: 'المشاريع الفرعية والبنود التفصيلية',
    hierarchy_collected: 'تم جمع',
    hierarchy_hint: '★ يوضّح هذا المخطط بنود المشروع وميزانية كل بند والمبلغ المُموَّل منه.',
    photos_title: 'صور من الميدان',
    photo_caption_credit: 'صورة من الميدان',
    updates_title: 'آخر التحديثات الميدانية',
    engineers_title: 'الفريق والمهندسون',
    comments_title: 'ملاحظات وتعليقات',
    auto_translated_label: 'ترجمة آلية',
    auto_translated_hint: 'تم توليد بعض النصوص الإنجليزية تلقائياً عبر MyMemory. يرجى الإبلاغ عن أي ترجمة غير دقيقة.',
    donate_raised_of: 'تم جمعه من أصل',

    // Contribution model: funding is handled by the Development Committee,
    // not online. Public sees a message; admins record contributions.
    contribute_title: '★ المساهمة في هذا المشروع',
    contribute_msg_before: 'للمساهمة في تمويل هذا المشروع، يُرجى التواصل مع',
    committee_name: 'لجنة التنمية',
    contribute_msg_after: 'في مدينة داريّا، وسيتمّ إيصال مساهمتكم إلى مجلس المدينة.',
    contribute_note: 'يُدار التمويل حصراً عبر لجنة التنمية ومجلس المدينة في داريّا.',
    fund_admin_title: 'تحديث تمويل المشروع',
    fund_admin_hint: 'سجّل مساهمة جديدة واردة عبر اللجنة. يظهر المبلغ للجمهور بعد إعادة بناء الموقع (١–٣ دقائق).',
    fund_current: 'التمويل الحالي',
    fund_target_label: 'يُضاف إلى',
    fund_amount_label: 'المبلغ المُضاف (دولار أمريكي)',
    fund_amount_ph: 'مثال: 500',
    fund_add_btn: 'إضافة إلى التمويل',
    fund_adding: 'جارٍ الحفظ…',
    fund_added: 'تم تحديث التمويل ✓',
    fund_invalid: 'يُرجى إدخال مبلغ صحيح أكبر من الصفر.',
    fund_exceeds: 'المبلغ يتجاوز المتبقّي من الميزانية. الحدّ الأقصى المسموح: {max}.',
    fund_exceeds_live: 'المبلغ يتجاوز الميزانية بعد آخر تحديث من مسؤول آخر. حدّث الصفحة لرؤية الأرقام الحالية.',
    fund_max_btn: 'الحدّ الأقصى',
    fund_remaining: 'المتبقّي حتى اكتمال الميزانية: {amount}',
    fund_target_full: '✓ هذا البند مموَّل بالكامل — لا يمكن إضافة المزيد.',

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
    trans_desc: 'كل مساهمة تصل عبر لجنة التنمية إلى مجلس المدينة تُسجَّل هنا على مشروعها، مع تحديثات ميدانية مؤرّخة وصور وتقارير منشورة — متاحة لأي شخص للاطلاع والتحقق.',
    trans_target_of: 'من',
    trans_target_label: 'مستهدفة',
    trans_gap_label: 'متبقٍّ لاستكمال تمويل جميع المشاريع',
    trans_reports_title: 'التقارير الرسمية',
    trans_reports_empty: 'لم يُنشر أي تقرير بعد. التقارير المرفوعة في «التعاميم والقرارات» ضمن فئة «تقرير» تظهر هنا تلقائياً.',
    trans_reports_note: 'تُنشر التقارير عبر صفحة التعاميم والقرارات.',
    trans_reports_all: 'جميع الوثائق ←',
    trans_completed: 'مشروع مكتمل',
    trans_completed_since: 'منذ إطلاق المنصة',

    // Admin dashboard
    admin_welcome: 'أهلاً بك في لوحة المجلس',
    admin_role: 'مجلس مدينة داريّا — نظرة عامة على المشاريع والنشاط',
    admin_eyebrow: '★ لوحة المجلس',
    admin_title: 'نظرة عامة على نشاط المنصة',
    admin_desc: 'متابعة حيّة لمشاريع إعادة الإعمار: التمويل حسب القطاع، والمشاريع التي تحتاج متابعة، وسجلّ النشاط.',
    admin_manage: 'إدارة المشاريع',
    admin_manage_desc: 'لتعديل المشاريع وإضافة تحديثات وصور، استخدم لوحة التحرير في {link}.',
    admin_cms_link: 'صفحة الإدارة',
    admin_col_project: 'المشروع',
    admin_col_budget: 'الميزانية',
    admin_col_raised: 'المحصّل',
    admin_btn_edit: 'تعديل',
    admin_manage_desc_v2: 'لإضافة مشروع جديد أو تعديل التفاصيل (التمويل، الحالة، الصور، الفريق) اضغط الأزرار أدناه. ستفتح لوحة إدارة المحتوى لإجراء التعديلات.',
    admin_new_project: 'مشروع جديد',
    admin_open_cms: 'فتح لوحة إدارة المحتوى',
    admin_actions_hint: '← تتطلب تسجيل الدخول إلى المحرّر',
    admin_col_status: 'الحالة',
    admin_btn_view: 'عرض',
    admin_btn_edit_hint: 'تعديل في لوحة إدارة المحتوى',
    admin_btn_view_hint: 'عرض الصفحة العامة',
    admin_help_title: '★ يمكنك من خلال لوحة إدارة المحتوى:',
    admin_help_funding: 'تعديل التمويل المطلوب والمحصّل لأي مشروع',
    admin_help_status: 'تغيير الحالة (مفتوح، قيد التنفيذ، مكتمل، متعثّر)',
    admin_help_photos: 'رفع صور حقيقية من الميدان (تستبدل تلقائياً الصور التوضيحية)',
    admin_help_engineers: 'إضافة المهندسين والفريق المسؤول عن كل مشروع',
    admin_help_comments: 'كتابة ملاحظات وتعليقات داخلية أو تحديثات ميدانية',
    admin_help_new: 'إنشاء مشاريع جديدة من الصفر مع كل التفاصيل',

    // Auth gate
    auth_required_title: 'هذه الصفحة مخصّصة لطاقم المجلس',
    auth_required_desc: 'تتطلب لوحة المجلس تسجيل الدخول. يستخدم الموظفون نفس حساب التحرير الخاص بهم.',
    auth_signin_btn: 'تسجيل الدخول ←',
    auth_loading: 'جاري التحقق…',
    auth_no_access_title: 'ليس لديك صلاحية للوصول',
    auth_no_access_desc: 'تم تسجيل دخولك، لكنك لست عضواً في طاقم المجلس. يرجى التواصل مع المشرف لمنحك الصلاحية.',
    auth_signout_btn: 'تسجيل الخروج',
    auth_signed_in_as: 'مسجّل دخوله كـ',

    // Footer
    footer_brand: 'نماء | Namaa',
    footer_about: 'منصة مجلس مدينة داريّا لإعادة الإعمار بمشاركة المجتمع المحلي وأبناء المدينة في المهجر. نعمل بشفافية كاملة لاستعادة مدينتنا، حجراً حجراً.',
    footer_nav: 'التصفّح',
    footer_contact: 'تواصل',
    footer_council: 'مجلس مدينة داريّا',
    footer_feedback: 'اقتراحات وملاحظات',
    footer_copyright: '© ٢٠٢٦ مجلس مدينة داريّا — الجمهورية العربية السورية',
    footer_design: 'صُمّمت بالهوية البصرية السورية الجديدة',

    // Map popup
    map_popup_funded: '٪ ممولة',
    map_popup_view: 'عرض التفاصيل ←',

    // Circulars & Decisions
    circ_title: 'التعاميم والقرارات',
    circ_subtitle: 'الوثائق الرسمية الصادرة عن مجلس المدينة',
    circ_desc: 'القرارات، التقارير، والإعلانات الصادرة عن مجلس مدينة داريّا. يمكنكم تحميل أي وثيقة ومراجعتها.',
    circ_count_one: 'وثيقة واحدة',
    circ_count_other: 'وثائق',
    circ_filter_all: 'الكل',
    circ_cat_decision: 'قرارات رسمية',
    circ_cat_announcement: 'إعلانات وتعاميم',
    circ_cat_report: 'تقارير',
    circ_cat_policy: 'سياسات ولوائح',
    circ_cat_minutes: 'محاضر اجتماعات',
    circ_cat_other: 'أخرى',
    circ_download: 'تحميل',
    circ_preview: 'معاينة',
    circ_uploaded_by: 'رفع بواسطة',
    circ_no_results: 'لا توجد وثائق في هذه الفئة بعد.',
    circ_upload_btn: '+ رفع وثيقة جديدة',
    circ_upload_title: 'رفع وثيقة جديدة',
    circ_upload_desc: 'الوثائق المرفوعة هنا تظهر فوراً للجمهور بعد إعادة بناء الموقع (١–٣ دقائق).',
    circ_field_title: 'العنوان (بالعربية)',
    circ_field_title_en: 'العنوان (بالإنجليزية، اختياري)',
    circ_field_desc: 'وصف موجز (بالعربية)',
    circ_field_desc_en: 'وصف موجز (بالإنجليزية، اختياري)',
    circ_field_category: 'الفئة',
    circ_field_date: 'تاريخ الإصدار',
    circ_field_file: 'الملف',
    circ_field_file_hint: 'PDF أو صورة أو مستند Word. الحد الأقصى ١٠ ميغابايت.',
    circ_btn_upload: 'رفع ونشر',
    circ_btn_cancel: 'إلغاء',
    circ_uploading: 'جاري الرفع…',
    circ_success: 'تم رفع الوثيقة',
    circ_success_sub: 'الموقع يُعاد بناؤه. ستظهر الوثيقة خلال ١–٣ دقائق. إن لم تظهر، تحقق من سجل البناء في Netlify.',
    circ_err_size: 'حجم الملف يتجاوز ١٠ ميغابايت.',
    circ_err_type: 'نوع الملف غير مدعوم.',
    circ_err_required: 'العنوان والملف مطلوبان.',
  },
  en: {
    nav_home: 'Home',
    nav_projects: 'Projects',
    nav_transparency: 'Transparency',
    nav_circulars: 'Circulars',
    nav_admin: 'Dashboard',
    nav_donate: 'How to contribute',
    nav_currency_title: 'Switch currency',
    nav_menu: 'Menu',
    brand_title: 'Namaa | نماء',
    brand_sub: 'City Council Reconstruction Platform',

    hero_eyebrow: 'Syrian Arab Republic — Darayya City Council',
    hero_h1_a: 'Together We Rebuild ',
    hero_h1_b: 'Darayya',
    hero_h1_tag: ',\nstone by stone, neighborhood by neighborhood.',
    hero_tag: 'A transparent platform for following Darayya\'s reconstruction step by step: what is being built on the ground, how much each project has raised, and where the money goes. Contributions are collected through the city\'s Development Committee and delivered to the City Council, and every step of progress is published here — from paving the street of your childhood to lighting the road to your school.',
    hero_btn_browse: 'Browse {n} open projects →',
    hero_btn_reports: 'Transparency Reports',
    hero_stats_title: '★ Live Statistics',
    hero_stat_raised: 'Total raised',
    hero_stat_target: 'Out of',
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
    days_remaining: 'days remaining',
    deadline_today: 'Funding deadline is today',

    // Activity log (home + dashboard)
    activity_recent: 'Recent Activity',
    activity_log_title: 'Activity Log',
    activity_log_desc: 'Everything happening across projects and documents, newest first, with the time of each.',
    activity_kind_update: 'Field update',
    activity_kind_note: 'Note',
    activity_kind_photo: 'New photo',
    activity_kind_funds: 'Contribution recorded',
    activity_kind_document: 'Document',
    activity_filter_all: 'All',
    activity_filter_label: 'Filter by type',
    activity_by: 'by {name}',
    activity_recorded_by: 'recorded by {name}',
    activity_show_more: 'Show more ({n} more)',
    activity_empty: 'No activity yet. New updates, notes, contributions and documents will appear here.',
    activity_del_funds_warning: 'This also takes {amount} off the project\'s raised total.',
    activity_del_doc_warning: 'The attached file is deleted too.',
    activity_deleted_toast: 'Deleted. Everyone sees the change after the site rebuilds (1–3 min).',
    // Council dashboard — figures computed from recorded data only
    dash_tile_funded: 'Funded so far',
    dash_tile_funded_sub: 'of {budget} · {pct}%',
    dash_tile_gap: 'Still needed',
    dash_tile_gap_sub: 'for {n} projects not yet fully funded',
    dash_tile_projects: 'Projects',
    dash_tile_projects_sub: '{open} open for funding · {active} in progress · {done} completed',
    dash_tile_recorded: 'Contributions recorded on the site',
    dash_tile_recorded_sub: '{n} entries · last 30 days: {recent}',
    dash_tile_recorded_none: 'None recorded on the site yet',
    dash_tile_attention: 'Need attention',
    dash_tile_attention_sub: 'projects with something to act on',
    dash_sectors_title: 'Funding by sector',
    dash_sectors_desc: 'Ordered by amount still needed — largest need first.',
    dash_sector_needed: '{gap} still needed',
    dash_attention_title: 'Projects needing attention',
    dash_attention_none: 'Nothing needs attention right now.',
    dash_reason_stalled: 'Stalled',
    dash_reason_warning: 'Marked as needing attention',
    dash_reason_deadline: 'Funding deadline passed before fully funded',
    dash_reason_funded_open: 'Fully funded but still marked “Open for funding” — update the status',
    dash_reason_completed_unfunded: 'Marked completed but only {pct}% funded',
    dash_reason_stale: 'No update for {days} days',
    dash_reason_never: 'No updates posted yet',
    dash_show_all: 'Show all ({n})',
    dash_col_last_update: 'Last update',
    dash_sort_stale: 'Least recently updated',

    breadcrumb_home: 'Home',
    breadcrumb_projects: 'Projects',
    hierarchy_title: 'Sub-projects and detailed items',
    hierarchy_collected: 'raised',
    hierarchy_hint: '★ This breakdown shows each item of the project, its budget, and how much has been funded.',
    photos_title: 'Photos from the Field',
    photo_caption_credit: 'Field photo',
    updates_title: 'Latest Field Updates',
    engineers_title: 'Team & Engineers',
    comments_title: 'Notes & Comments',
    auto_translated_label: 'Auto-translated',
    auto_translated_hint: 'Some English text on this page was auto-translated via MyMemory and may be imperfect. Please report any mistranslations.',
    donate_raised_of: 'raised out of',

    // Contribution model: funding is handled by the Development Committee,
    // not online. Public sees a message; admins record contributions.
    contribute_title: '★ Contributing to this Project',
    contribute_msg_before: 'To contribute funding to this project, please contact the',
    committee_name: 'Development Committee (لجنة التنمية)',
    contribute_msg_after: 'in Darayya, and your contribution will be delivered to the City Council.',
    contribute_note: 'Funding is handled exclusively through the Development Committee and the City Council in Darayya.',
    fund_admin_title: 'Update project funds',
    fund_admin_hint: 'Record a new contribution received through the committee. It becomes public after the site rebuilds (1–3 min).',
    fund_current: 'Current funds',
    fund_target_label: 'Add to',
    fund_amount_label: 'Amount to add (USD)',
    fund_amount_ph: 'e.g. 500',
    fund_add_btn: 'Add to funds',
    fund_adding: 'Saving…',
    fund_added: 'Funds updated ✓',
    fund_invalid: 'Please enter a valid amount greater than zero.',
    fund_exceeds: 'That amount is more than the remaining budget. The most you can add is {max}.',
    fund_exceeds_live: 'That amount would exceed the budget after another admin\'s latest update. Refresh the page to see current figures.',
    fund_max_btn: 'Max',
    fund_remaining: 'Remaining until fully funded: {amount}',
    fund_target_full: '✓ This item is fully funded — nothing more can be added.',

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
    trans_desc: 'Every contribution delivered through the Development Committee to the City Council is recorded here against its project, alongside dated field updates, photos and published reports — open for anyone to check.',
    trans_target_of: 'of',
    trans_target_label: 'target',
    trans_gap_label: 'still needed to fully fund every project',
    trans_reports_title: 'Official Reports',
    trans_reports_empty: 'No reports published yet. Reports uploaded under Circulars & Decisions with the category “Report” appear here automatically.',
    trans_reports_note: 'Reports are published through the Circulars & Decisions page.',
    trans_reports_all: 'All documents →',
    trans_completed: 'completed project(s)',
    trans_completed_since: 'since platform launch',

    admin_welcome: 'Welcome to the Council Dashboard',
    admin_role: 'Darayya City Council — Overview of projects and activity',
    admin_eyebrow: '★ Council Dashboard',
    admin_title: 'Platform activity at a glance',
    admin_desc: 'Live overview of reconstruction projects: funding by sector, projects needing attention, and the activity log.',
    admin_manage: 'Project Management',
    admin_manage_desc: 'To edit projects, add updates, and upload photos, use the editor at {link}.',
    admin_cms_link: 'admin page',
    admin_col_project: 'Project',
    admin_col_budget: 'Budget',
    admin_col_raised: 'Raised',
    admin_btn_edit: 'Edit',
    admin_manage_desc_v2: 'To add a new project or edit details (funding, status, photos, team), click the buttons below. The content management panel will open for editing.',
    admin_new_project: 'New Project',
    admin_open_cms: 'Open Content Manager',
    admin_actions_hint: '← Requires editor sign-in',
    admin_col_status: 'Status',
    admin_btn_view: 'View',
    admin_btn_edit_hint: 'Edit in content manager',
    admin_btn_view_hint: 'View public page',
    admin_help_title: '★ In the content manager you can:',
    admin_help_funding: 'Adjust the funding goal and amount raised for any project',
    admin_help_status: 'Change status (Open for funding, Active, Completed, Stalled)',
    admin_help_photos: 'Upload real field photos (these replace the illustrative ones automatically)',
    admin_help_engineers: 'Add engineers and team members responsible for each project',
    admin_help_comments: 'Write internal notes, comments, or dated field updates',
    admin_help_new: 'Create new projects from scratch with all the details',

    auth_required_title: 'This page is for council staff',
    auth_required_desc: 'The Council Dashboard requires sign-in. Staff use the same account they use to edit content.',
    auth_signin_btn: 'Sign in →',
    auth_loading: 'Checking…',
    auth_no_access_title: 'You don\'t have access',
    auth_no_access_desc: 'You are signed in, but you are not part of the council staff. Please contact your administrator to be granted access.',
    auth_signout_btn: 'Sign out',
    auth_signed_in_as: 'Signed in as',

    footer_brand: 'Namaa | نماء',
    footer_about: 'The Darayya City Council\'s platform for reconstruction with participation from the local community and the diaspora. We work with complete transparency to restore our city, stone by stone.',
    footer_nav: 'Navigation',
    footer_contact: 'Contact',
    footer_council: 'Darayya City Council',
    footer_feedback: 'Suggestions & feedback',
    footer_copyright: '© 2026 Darayya City Council — Syrian Arab Republic',
    footer_design: 'Designed with the New Syrian Visual Identity',

    map_popup_funded: '% funded',
    map_popup_view: 'View details →',

    // Circulars & Decisions
    circ_title: 'Circulars & Decisions',
    circ_subtitle: 'Official documents issued by the City Council',
    circ_desc: 'Decisions, reports, and announcements published by the Darayya City Council. Any document can be downloaded and reviewed.',
    circ_count_one: '1 document',
    circ_count_other: 'documents',
    circ_filter_all: 'All',
    circ_cat_decision: 'Official Decisions',
    circ_cat_announcement: 'Announcements',
    circ_cat_report: 'Reports',
    circ_cat_policy: 'Policies',
    circ_cat_minutes: 'Meeting Minutes',
    circ_cat_other: 'Other',
    circ_download: 'Download',
    circ_preview: 'Preview',
    circ_uploaded_by: 'Uploaded by',
    circ_no_results: 'No documents in this category yet.',
    circ_upload_btn: '+ Upload new document',
    circ_upload_title: 'Upload a new document',
    circ_upload_desc: 'Uploaded documents appear publicly after the site rebuilds (1–3 minutes).',
    circ_field_title: 'Title (Arabic, required)',
    circ_field_title_en: 'Title (English, optional)',
    circ_field_desc: 'Brief description (Arabic)',
    circ_field_desc_en: 'Brief description (English, optional)',
    circ_field_category: 'Category',
    circ_field_date: 'Issue date',
    circ_field_file: 'File',
    circ_field_file_hint: 'PDF, image, or Word doc. Max 10 MB.',
    circ_btn_upload: 'Upload & publish',
    circ_btn_cancel: 'Cancel',
    circ_uploading: 'Uploading…',
    circ_success: 'Document uploaded',
    circ_success_sub: 'Site is rebuilding. The document will appear in 1–3 minutes. If it doesn\'t, check the Netlify build log.',
    circ_err_size: 'File exceeds 10 MB.',
    circ_err_type: 'File type not supported.',
    circ_err_required: 'Title and file are required.',
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
 * Falls back to AR when EN is missing or empty — supports the CMS workflow
 * where staff only fill Arabic and leave English blank.
 */
export function loc<T extends { ar: string; en?: string }>(lang: Lang, obj: T | undefined): string {
  if (!obj) return '';
  if (lang === 'en') return obj.en || obj.ar;
  // Something posted in English only still shows on the Arabic page.
  return obj.ar || obj.en || '';
}

/**
 * Returns true when the EN string for this object was filled by the MyMemory
 * auto-translator (not by a human). UI components use this to show a small
 * "auto-translated" indicator that asks readers to flag mistranslations.
 */
export function isAutoTranslated(lang: Lang, obj: { en_auto?: boolean } | undefined): boolean {
  if (!obj || lang !== 'en') return false;
  return obj.en_auto === true;
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
