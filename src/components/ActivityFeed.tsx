import { type Lang } from '../i18n/strings';
import { type ActivityEntry } from '../data/activity-feed';

type Props = {
  entries: ActivityEntry[];
  lang: Lang;
  basePath: string;
  /** Empty-state line shown when there are no entries yet */
  emptyText?: string;
};

/**
 * Renders a list of activity entries (updates + comments across projects).
 * Used on the dashboard and on the home page footer. Each row links to
 * its source project; the row's leading dot is colored by entry type
 * (green = update, blue = comment, gold = donation/other).
 *
 * No state, no auth — just pure presentation. The consumer builds the
 * entries array via buildActivityFeed() in src/data/activity-feed.ts.
 */
export default function ActivityFeed({ entries, lang, basePath, emptyText }: Props) {
  if (entries.length === 0) {
    return (
      <div className="activity-feed-empty">
        {emptyText || (lang === 'ar'
          ? 'لا توجد أنشطة بعد. ستظهر هنا التحديثات والتعليقات الجديدة.'
          : 'No activity yet. Updates and comments will appear here.')}
      </div>
    );
  }
  return (
    <div className="activity-feed">
      {entries.map((a, i) => (
        <a
          key={i}
          className="activity-item activity-item-link"
          href={`${basePath}/projects/${a.projectId}/`}
        >
          <span className={`activity-dot ${a.color}`}></span>
          <div className="activity-body">
            <div className="activity-text" dangerouslySetInnerHTML={{ __html: a.text }} />
            <div className="activity-time">{a.time}</div>
          </div>
        </a>
      ))}
    </div>
  );
}
