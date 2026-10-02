import type { SpellDef } from './types';

export const SPELLS: SpellDef[] = [
  {
    id: 'screech', name: 'Sonic Screech', clans: [], rarity: 'common', cost: 3, icon: '〰',
    effect: { kind: 'stunFront', seconds: 2.5, radius: 180 },
    desc: 'Stun enemies near the front for 2.5s.',
  },
  {
    id: 'guano_bomb', name: 'Guano Bomb', clans: [], rarity: 'common', cost: 4, icon: '💩',
    effect: { kind: 'damageFront', amount: 120, radius: 120 },
    desc: 'Deal 120 damage around the front enemy.',
  },
  {
    id: 'night_fog', name: 'Night Fog', clans: [], rarity: 'rare', cost: 3, icon: '🌫',
    effect: { kind: 'slowAll', pct: 50, seconds: 5 },
    desc: 'All enemies move and attack 50% slower for 5s.',
  },
  {
    id: 'ripe_harvest', name: 'Ripe Harvest', clans: ['FRU'], rarity: 'common', cost: 4, icon: '🍑',
    effect: { kind: 'healAll', pct: 35, caveHeal: 60 },
    desc: 'Heal all bats 35% and the cave 60.',
  },
  {
    id: 'swarm_call', name: 'Swarm Call', clans: ['INS'], rarity: 'rare', cost: 5, icon: '🦟',
    effect: { kind: 'summon', batId: 'little_brown', count: 4 },
    desc: 'Summon 4 Little Brown Bats.',
  },
  {
    id: 'blood_moon', name: 'Blood Moon', clans: ['SAN'], rarity: 'rare', cost: 4, icon: '🌕',
    effect: { kind: 'buffAll', atkPct: 30, lifesteal: 25, seconds: 6 },
    desc: 'All bats +30% attack and 25% lifesteal for 6s.',
  },
  {
    id: 'moonlit_dive', name: 'Moonlit Dive', clans: ['PIS'], rarity: 'common', cost: 4, icon: '🎣',
    effect: { kind: 'damageStrongest', amount: 220 },
    desc: 'Deal 220 damage to the toughest enemy.',
  },
  {
    id: 'pollen_burst', name: 'Pollen Burst', clans: ['NEC'], rarity: 'rare', cost: 3, icon: '🌸',
    effect: { kind: 'hasteAll', pct: 50, seconds: 6, energy: 2 },
    desc: 'All bats attack 50% faster for 6s. Refund 2 energy.',
  },
];

export const SPELL_BY_ID: Record<string, SpellDef> = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
