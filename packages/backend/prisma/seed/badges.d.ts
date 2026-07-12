export interface BadgeSeed {
    key: string;
    nameCs: string;
    nameEn: string;
    descriptionCs: string;
    descriptionEn: string;
    icon: string;
    category: string;
    ruleType: 'COUNT' | 'STREAK' | 'FIRST' | 'SPECIAL';
    metric: string;
    threshold: number;
    tier: 'BRONZE' | 'SILVER' | 'GOLD';
    sortOrder: number;
}
export declare const BADGES_SEED: BadgeSeed[];
//# sourceMappingURL=badges.d.ts.map