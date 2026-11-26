import { useEffect, useState } from 'react';
import { can, canPostOn, type AuthUser } from './permissions';
import { readLiveTeam } from './project-file-edit';

/**
 * May this signed-in person post notes, updates and photos on the project?
 * Checks the team the page was built with first; if that doesn't list them
 * and they're an engineer, checks the team in the repository right now (the
 * same file the save service checks). Only decides which buttons to show.
 */
export function useCanPost(user: AuthUser | null, projectId: string, engineers: unknown): boolean {
  const quick = !!user && canPostOn(user, engineers);
  const [live, setLive] = useState(false);
  const needsLive = !!user && !quick && can(user, 'post-assigned-project');

  useEffect(() => {
    if (!needsLive) return;
    let cancelled = false;
    readLiveTeam(projectId).then((team) => {
      if (!cancelled) setLive(canPostOn(user, team));
    });
    return () => { cancelled = true; };
  }, [needsLive, projectId, user]);

  return quick || (needsLive && live);
}
