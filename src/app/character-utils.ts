// Handles D&D and Dark Heresy point objects safely
export const getPointsObject = (p: any) => {
    if (typeof p === 'object' && p !== null && 'max' in p && 'current' in p) {
        return { current: p.current, max: p.max, notes: p.notes || '' };
    }
    return { current: 0, max: 0, notes: '' };
};

export const getSimplePointsObject = (p: any) => {
    if (typeof p === 'object' && p !== null && 'total' in p) {
        return { total: p.total, notes: p.notes || '' };
    }
    return { total: 0, notes: '' };
};