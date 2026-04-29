import { useEffect } from 'react';

/**
 * Custom hook loogu talagalay inuu xogta si toos ah u cusboonaysiiyo.
 * @param {Function} callback - Function-ka soo jiidaya xogta (tusaale: fetchData)
 * @param {number} interval - Inta u dhaxaysa wicitaanada (milliseconds, default waa 10s)
 */
export const useAutoUpdate = (callback, interval = 10000) => {
  useEffect(() => {
    callback(); // Wac isla marka uu component-ku dhasho
    const timerId = setInterval(callback, interval);

    return () => clearInterval(timerId); // Jooji marka bogga laga baxo si loo ilaaliyo performance-ka
  }, [callback, interval]);
};