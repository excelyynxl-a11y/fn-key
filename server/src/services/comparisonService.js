import { COMPARISON_FIELDS } from '../constants/challenge.js';

export function compareDocuments(siFields, blFields) {
  const missingFields = COMPARISON_FIELDS.filter((field) => (
    siFields[field]?.normalizedValue === null
    || siFields[field]?.normalizedValue === undefined
    || blFields[field]?.normalizedValue === null
    || blFields[field]?.normalizedValue === undefined
  ));

  if (missingFields.length > 0) {
    return {
      status: 'NEEDS_REVIEW',
      reviewReason: 'missing_value',
      hasDefect: false,
      defectFields: [],
      fieldDetails: {},
      missingFields
    };
  }

  const defectFields = COMPARISON_FIELDS.filter((field) => (
    siFields[field].normalizedValue !== blFields[field].normalizedValue
  ));
  const fieldDetails = Object.fromEntries(defectFields.map((field) => [field, {
    SI: siFields[field].rawValue,
    BL: blFields[field].rawValue
  }]));

  return defectFields.length === 0
    ? {
        status: 'OK',
        reviewReason: null,
        hasDefect: false,
        defectFields: [],
        fieldDetails: {},
        missingFields: []
      }
    : {
        status: 'MISMATCH',
        reviewReason: null,
        hasDefect: true,
        defectFields,
        fieldDetails,
        missingFields: []
      };
}

