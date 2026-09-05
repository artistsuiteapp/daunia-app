import { teamKey } from './util.mjs';

/**
 * Le due fonti scrivono i nomi in modo diverso: "AUDACE CERIGNOLA" contro "Cerignola",
 * "AZ PICERNO" contro "Picerno". Il match esatto su teamKey non basta, serve un fallback
 * su contenimento, con guardia sulla lunghezza per non incrociare squadre diverse.
 */
export function makeTeamResolver(teamsByKey) {
  const keys = [...teamsByKey.keys()];
  const cache = new Map();

  return function resolve(name) {
    if (!name) return null;
    const key = teamKey(name);
    if (cache.has(key)) return cache.get(key);

    let hit = teamsByKey.get(key) || null;
    if (!hit) {
      const candidates = keys.filter((k) => {
        if (k === key) return true;
        const [long, short] = k.length >= key.length ? [k, key] : [key, k];
        return short.length >= 4 && long.split('-').includes(short);
      });
      if (candidates.length === 1) hit = teamsByKey.get(candidates[0]);
    }
    cache.set(key, hit);
    return hit;
  };
}

/** Squadra minima quando la fonte non ha lo stemma: meglio un placeholder che un buco. */
export function fallbackTeam(name) {
  return { id: teamKey(name), name, shortName: name, crest: null, isFoggia: teamKey(name) === 'foggia' };
}
