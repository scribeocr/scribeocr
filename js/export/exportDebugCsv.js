/**
 * Escapes special characters in CSV fields.
 * @param {string|number|boolean} field - The field to escape.
 */
const escapeCSVField = (field) => {
  if (typeof field === 'string') {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

/**
     * Converts an array of objects with atomic properties (string, number, boolean) to a CSV string.
     * @param {Array<Object>} data - The array of data objects.
     * @returns {string} - The CSV string.
     */
export const convertToCSV = (data) => {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const rows = data.map((item) => headers.map((header) => escapeCSVField(item[header])).join(','),
  );

  return [headers.join(','), ...rows].join('\n');
};
