/** Boss rules (Balatro's boss blinds): each boss level bends one rule against you. */
export type BossRuleId = 'owl_watch' | 'drought' | 'hawk_eye' | 'storm';

export interface BossRule {
  id: BossRuleId;
  name: string;
  icon: string;
  desc: string;
}

export const BOSS_RULES: BossRule[] = [
  { id: 'owl_watch', name: "Owl's Watch", icon: '🦉', desc: 'The leftmost column can\'t hold roosts.' },
  { id: 'drought', name: 'Drought', icon: '🏜', desc: 'Roosts make no guano at dawn.' },
  { id: 'hawk_eye', name: "Hawk's Eye", icon: '🦅', desc: 'Each dusk, your highest-level roost loses a level.' },
  { id: 'storm', name: 'Storm', icon: '⛈', desc: 'The pool shows one fewer card.' },
];

export const BOSS_RULE_BY_ID: Record<string, BossRule> = Object.fromEntries(BOSS_RULES.map((r) => [r.id, r]));
