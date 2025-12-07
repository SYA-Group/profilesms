// src/utils/sms.ts
export const getSmsUnits = (text: string): number => {
    const length = text.length;
  
    if (length === 0) return 0;
    if (length <= 70) return 1;
  
    return Math.ceil((length - 70) / 67) + 1;
  };
  