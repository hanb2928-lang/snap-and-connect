import { supabase } from '@/lib/supabase';
import { addCredits } from '@/lib/credits';

export type QuestType = 'daily_publish' | 'weekly_multiplatform' | 'daily_scan' | 'weekly_streak';

export interface Quest {
  id: string;
  quest_type: QuestType;
  title: string;
  description: string;
  reward_credits: number;
  target_count: number;
  current_count: number;
  status: 'active' | 'completed' | 'claimed';
  period_start: string;
  period_end: string;
}

const QUEST_DEFINITIONS: Omit<Quest, 'id' | 'current_count' | 'status' | 'period_start' | 'period_end'>[] = [
  {
    quest_type: 'daily_publish',
    title: '오늘의 숏폼 발행',
    description: '떡상 추천 상품 숏폼 1개 발행하기',
    reward_credits: 50,
    target_count: 1,
  },
  {
    quest_type: 'daily_scan',
    title: '상품 분석 3회',
    description: '오늘 상품 3개 분석하기',
    reward_credits: 30,
    target_count: 3,
  },
  {
    quest_type: 'weekly_multiplatform',
    title: '3플랫폼 동시 발행',
    description: '유튜브/인스타/틱톡에 동시 발행하기',
    reward_credits: 100,
    target_count: 3,
  },
  {
    quest_type: 'weekly_streak',
    title: '일주일 연속 방문',
    description: '7일 연속 앱 접속하기',
    reward_credits: 200,
    target_count: 7,
  },
];

function getDailyPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getWeeklyPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getActiveQuests(): Promise<Quest[]> {
  try {
    const { data: existing } = await supabase
      .from('daily_quests')
      .select('*')
      .eq('status', 'active')
      .gte('period_end', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (existing && existing.length > 0) {
      return existing as Quest[];
    }

    // Generate new daily quests
    const daily = getDailyPeriod();
    const weekly = getWeeklyPeriod();
    const newQuests = QUEST_DEFINITIONS.map((def) => {
      const isWeekly = def.quest_type.startsWith('weekly');
      const period = isWeekly ? weekly : daily;
      return {
        ...def,
        current_count: 0,
        status: 'active' as const,
        period_start: period.start,
        period_end: period.end,
      };
    });

    const { data: created, error } = await supabase
      .from('daily_quests')
      .insert(newQuests)
      .select();

    if (error || !created) return [];
    return created as Quest[];
  } catch {
    return [];
  }
}

export async function incrementQuestProgress(questType: QuestType, amount: number = 1): Promise<void> {
  try {
    const { data: quest } = await supabase
      .from('daily_quests')
      .select('*')
      .eq('quest_type', questType)
      .eq('status', 'active')
      .gte('period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!quest) return;

    const newCount = Math.min(quest.current_count + amount, quest.target_count);
    const newStatus = newCount >= quest.target_count ? 'completed' : 'active';

    await supabase
      .from('daily_quests')
      .update({ current_count: newCount, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', quest.id);
  } catch {
    // non-fatal
  }
}

export async function claimQuestReward(questId: string): Promise<number> {
  try {
    const { data: quest } = await supabase
      .from('daily_quests')
      .select('*')
      .eq('id', questId)
      .maybeSingle();

    if (!quest || quest.status !== 'completed') return 0;

    await supabase
      .from('daily_quests')
      .update({ status: 'claimed', updated_at: new Date().toISOString() })
      .eq('id', questId);

    await addCredits(quest.reward_credits, 'bonus', `퀘스트 보상: ${quest.title}`);
    return quest.reward_credits;
  } catch {
    return 0;
  }
}

export async function getCompletedQuests(): Promise<Quest[]> {
  try {
    const { data } = await supabase
      .from('daily_quests')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    return (data as Quest[]) ?? [];
  } catch {
    return [];
  }
}
