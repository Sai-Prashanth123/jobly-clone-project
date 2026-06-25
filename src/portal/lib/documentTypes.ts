// Canonical list of document types HR can upload against an employee.
//
// Kept in sync with the Add Employee form (NewEmployee.tsx):
//   - "Profile Photo" is set by the profile-photo tile in section 01
//   - Each identity-doc label (Driver's License, Passport, etc.) matches
//     a row in IDENTITY_DOC_ROWS so uploads from section 07 line up with the
//     dropdown options here
//   - Resume/Offer Letter/etc. are the generic types HR may attach later

export const DOCUMENT_TYPES: string[] = [
  'Profile Photo',
  'Resume',
  'Offer Letter',
  'I-9 Form',
  'W-4',
  'W-9',
  'Social Security Number',
  "Driver's License",
  'State-Issued ID',
  'Passport',
  'Permanent Resident Card',
  'Employment Authorization Document',
  'OPT Card',
  'STEM OPT Card',
  'I-983 Form',
  'I-94',
  'ID Proof',
  'Compliance Document',
  'Other',
];
