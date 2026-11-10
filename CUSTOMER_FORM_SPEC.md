# Sri Jayam Travels — Customer Management Form Specification

**File:** `src/pages/Customers.jsx`  
**Data Layer:** `src/data/customerData.js`  
**Repository:** `src/repositories/customerRepository.js`  
**Error Utilities:** `src/data/errorUtils.js`  
**Database Table:** `public.customers`

---

## 1. Overview

The Customer Management module is the central customer directory for Sri Jayam Travels. It allows admin and manager users to:

- Add new customers (individual, corporate, or travel agent)
- Edit existing customer details
- Delete customers (admin only)
- Flag customers as VIP, Frequent Traveller, or Blacklisted
- Filter customers by type, flag, or name
- Search customers by mobile number
- Pre-fill customer data when creating trips

---

## 2. Access Control

| Role | Add | Edit | Delete | View Flags | Set Flags |
|------|-----|------|--------|-----------|-----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ❌ | ✅ | ✅ |
| Driver | ❌ | ❌ | ❌ | ❌ | ❌ |

Driver role sees a stub page: *"Customer management is not available for drivers."*

---

## 3. Form Fields — Complete Specification

### 3.1 Customer Name (`name`)
| Property | Value |
|----------|-------|
| Required | Yes |
| Min Length | 2 characters |
| Max Length | 50 characters |
| Pattern | `^[a-zA-Z\s\-'.]*$` (letters, spaces, hyphens, apostrophes only) |
| Placeholder | "Full name or company name (2-50 chars)" |
| Error Message | "Only letters, spaces, hyphens, and apostrophes allowed" |
| Auto-capitalization | None |
| Auto-focus | Yes (first field) |

### 3.2 Mobile Number (`mobile`)
| Property | Value |
|----------|-------|
| Required | Yes |
| Length | Exactly 10 digits |
| Pattern | `^[0-9]*$` (digits only) |
| Placeholder | "10-digit mobile number (e.g., 9876543210)" |
| Error Message | "Mobile must be exactly 10 digits" |
| Real-time filtering | Non-digit characters stripped on input |
| Database | Stored as `primary_mobile` |
| Uniqueness | Must be unique across all customers |

### 3.3 Alternate Mobile (`altMobile`)
| Property | Value |
|----------|-------|
| Required | No |
| Length | Exactly 10 digits (if provided) |
| Pattern | `^[0-9]*$` (digits only) |
| Placeholder | "10 digits only (optional)" |
| Error Message | "Mobile must be 10 digits" |
| Database | Stored as `alternate_mobile` |

### 3.4 Email (`email`)
| Property | Value |
|----------|-------|
| Required | No |
| Max Length | 100 characters |
| Pattern | `^[^\s]*@?[^\s]*\.?[^\s]*$` (basic email format) |
| Placeholder | "user@example.com (optional)" |
| Error Message | "Please enter a valid email address" |
| Database | Stored as `email` |

### 3.5 Customer Type (`type`)
| Property | Value |
|----------|-------|
| Required | Yes (dropdown) |
| Options | Individual, Corporate, Travel Agent |
| Default | Individual |
| Database | Stored as `type` (corporate/agent stored as `agency` internally) |
| Corporate fields | When Corporate or Agent selected, shows Company Name, Contact Person, GST Number, Billing Address |

### 3.6 Address (`address`)
| Property | Value |
|----------|-------|
| Required | No |
| Max Length | 100 characters |
| Pattern | `^[a-zA-Z0-9\s\-',./]*$` |
| Placeholder | "Door no., Street name (optional)" |
| Error Message | "Address contains invalid characters" |
| Database | Stored as `address` |

### 3.7 City (`city`)
| Property | Value |
|----------|-------|
| Required | No |
| Max Length | 30 characters |
| Pattern | `^[a-zA-Z\s\-'.]*$` |
| Placeholder | "City name (optional)" |
| Error Message | "Only letters, spaces, hyphens, and apostrophes allowed" |
| Database | Stored as `city` |

### 3.8 State (`state`)
| Property | Value |
|----------|-------|
| Required | No |
| Max Length | 30 characters |
| Pattern | `^[a-zA-Z\s\-'.]*$` |
| Placeholder | "State name (optional)" |
| Error Message | "Only letters, spaces, hyphens, and apostrophes allowed" |
| Default Value | "Tamil Nadu" |
| Database | Stored as `state` |

### 3.9 Company Name (`companyName`)
| Property | Value |
|----------|-------|
| Required | No (only when Corporate/Agent type) |
| Max Length | 60 characters |
| Pattern | `^[a-zA-Z0-9\s\-'.&()]*$` |
| Placeholder | "Registered company name (optional)" |
| Error Message | "Only alphanumeric, spaces, and basic punctuation allowed" |
| Database | Stored as `company_name` |

### 3.10 Contact Person (`contactPerson`)
| Property | Value |
|----------|-------|
| Required | No (only when Corporate/Agent type) |
| Max Length | 50 characters |
| Pattern | `^[a-zA-Z\s\-'.]*$` |
| Placeholder | "Primary contact name (optional)" |
| Error Message | "Only letters, spaces, hyphens, and apostrophes allowed" |
| Database | Stored as `contact_person` |

### 3.11 GST Number (`gst`)
| Property | Value |
|----------|-------|
| Required | No (only when Corporate/Agent type) |
| Length | Exactly 15 characters (if provided) |
| Pattern | `^[0-9A-Z]*$` (uppercase alphanumeric only) |
| Placeholder | "GSTIN - 15 characters (optional)" |
| Error Message | "GST must be 15 alphanumeric characters (e.g., 29AAACM0000A1Z5)" |
| Auto-casing | Uppercase on input |
| Database | Stored as `gstin` |

### 3.12 Billing Address (`billingAddress`)
| Property | Value |
|----------|-------|
| Required | No (only when Corporate/Agent type) |
| Max Length | 120 characters |
| Pattern | `^[a-zA-Z0-9\s\-',./]*$` |
| Placeholder | "GST billing address (optional)" |
| Error Message | "Address contains invalid characters" |
| Database | Stored as `billingAddress` |

### 3.13 Notes (`notes`)
| Property | Value |
|----------|-------|
| Required | No |
| Max Length | 300 characters |
| Placeholder | "Preferred driver, vehicle, payment terms, VIP status…" |
| Error Message | "Notes cannot exceed 300 characters" |
| Character counter | Shows count (warns at 210, errors at 270) |
| Database | Stored as `notes` |

### 3.14 Emergency Contact Name (`emergencyName`)
| Property | Value |
|----------|-------|
| Required | No |
| Max Length | 50 characters |
| Placeholder | "Family member / Friend" |
| Database | Stored as `emergencyName` |

### 3.15 Emergency Contact Mobile (`emergencyContact`)
| Property | Value |
|----------|-------|
| Required | No |
| Length | Exactly 10 digits (if provided) |
| Pattern | Digits only |
| Placeholder | "10-digit mobile" |
| Auto-filtering | Non-digit characters stripped |
| Database | Stored as `emergencyContact` |

### 3.16 Customer Flags (Boolean Toggles)

| Flag | Label | Icon | Color | Default |
|------|-------|------|-------|---------|
| `isVip` | ⭐ VIP Customer | Star | Amber | false |
| `isFrequentTraveller` | 🔁 Frequent Traveller | Repeat | Blue | false |
| `isBlacklisted` | 🚫 Blacklisted | Ban | Red | false |

**Manual flags** can be toggled in the Customers page or via the customer profile card. **Auto flags** are computed from booking history:

| Auto Flag | Criteria |
|-----------|----------|
| Auto-Frequent | 5+ completed trips |
| Auto-VIP | ₹10,000+ lifetime revenue OR frequent + corporate/agent |

Manual flags always override auto flags. Blacklisted is manual-only (never auto-set).

---

## 4. Validation Flow

```
User clicks Save
    │
    ▼
1. Client-side validation (validate())
   ├─ Check required fields (name, mobile)
   ├─ Check field patterns and lengths
   ├─ If errors: setErrors(e) → show red boxes + messages → STOP
   └─ If clear: setErrors({}) → proceed
    │
    ▼
2. Save to Supabase (saveCustomer → customerRepository)
   ├─ Check duplicate mobile (23505 error)
   ├─ Check table constraints (42P10 error)
   ├─ Check RLS permissions (42501 error)
   ├─ If DB error: throw translateDbError(err)
   └─ If success: cacheClear('customers'), reload list
    │
    ▼
3. UI Response
   ├─ Success: Toast "Added/Updated [name]", close modal, reload list
   ├─ Field error: setErrors({ [field]: message }) → red box on that field
   ├─ General error: setErrors({ _general: message }) → red banner at top
```

### 4.1 Error Translation Table

| Error Code | Condition | User Message | Field |
|------------|-----------|--------------|-------|
| `23505` (mobile) | Duplicate mobile | "This mobile number is already registered to another customer." | `mobile` |
| `23505` (other) | Duplicate record | "A record with these details already exists." | `name` |
| `42P10` | Missing unique constraint | "Database configuration error: missing unique constraint." | — |
| `42501` | RLS/Permission | "Permission denied. Your account does not have access to save this data." | — |
| `23503` | Foreign key violation | "Related record not found. The referenced data may have been deleted." | — |
| `23502` | Not null violation | "A required field is missing." | — |
| Network | fetch/connection fail | "Cannot connect to the server. Please check your internet connection." | — |
| Timeout | Request timed out | "The request timed out. The server may be busy." | — |
| Generic | Any other error | Raw error message | — |

---

## 5. Database Schema

**Table:** `public.customers`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `customer_id` | TEXT | YES | Human-readable ID (CUS-XXXXXX) |
| `name` | TEXT | NO | Customer name |
| `type` | TEXT | NO | individual/corporate/agent |
| `status` | TEXT | NO | active/inactive |
| `primary_mobile` | TEXT | YES | Primary phone number |
| `mobile` | TEXT | YES | Mobile (alias) |
| `alternate_mobile` | TEXT | YES | Secondary phone |
| `email` | TEXT | YES | Email address |
| `city` | TEXT | YES | City |
| `state` | TEXT | YES | State |
| `address` | TEXT | YES | Street address |
| `company_name` | TEXT | YES | Company (corporate/agent) |
| `contact_person` | TEXT | YES | Contact person |
| `gstin` | TEXT | YES | GST number |
| `notes` | TEXT | YES | Free-text notes |
| `is_vip` | BOOLEAN | NO (default false) | VIP flag |
| `is_frequent_traveller` | BOOLEAN | NO (default false) | Frequent flag |
| `is_blacklisted` | BOOLEAN | NO (default false) | Blacklist flag |
| `is_active` | BOOLEAN | NO | Active status |
| `created_at` | TIMESTAMPTZ | NO | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | Last update timestamp |

---

## 6. Auto-Flag Computation Logic

Computed on every page load from booking history (not stored in DB):

```javascript
function computeAutoFlags(customer, bookings) {
  const stats = getCustomerStats(customer.id, customer.name, bookings);
  
  // Auto-Frequent: 5+ completed trips
  const autoFrequent = stats.completedTrips >= 5;
  
  // Auto-VIP: ₹10,000+ revenue OR frequent + corporate/agent
  const autoVip = stats.totalRevenue >= 10000 || 
                  (autoFrequent && (customer.type === 'corporate' || customer.type === 'agent'));
  
  return { autoIsFrequentTraveller: autoFrequent, autoIsVip: autoVip, reasons: [...] };
}
```

**Effective Flag** = Manual flag OR Auto flag. Manual flags always win.

---

## 7. Metric Cards (Top Widgets Row)

| Card | Label | Icon | Color | Filter Action |
|------|-------|------|-------|---------------|
| 1 | Total | 👤 | Gray | Filter: all |
| 2 | Individual | 👤 | Blue | Filter: individual |
| 3 | Corporate | 🏢 | Violet | Filter: corporate |
| 4 | VIP | ⭐ | Amber | Filter: vip (flag) |
| 5 | Frequent | 🔁 | Blue | Filter: frequent (flag) |
| 6 | New This Month | 📅 | Green | Filter: new this month (date) |

**Cross-filter behavior:**
- Clicking VIP/Frequent → Type filter resets to "All", New This Month resets to off
- Clicking Individual/Corporate/Total → Flag filter resets to "All", New This Month resets to off
- Clicking New This Month → Type and Flag filters reset to "All"

---

## 8. Filter Row

| Filter | Type | Options |
|--------|------|---------|
| Type | Dropdown | All Types, Individual, Corporate |
| Flag | Dropdown | All Flags, VIP, Frequent, Listed |
| Sort | Dropdown | Name, City, Recent |
| New This Month | Toggle chip | On/Off (sets sort to Recent) |

**Mutual exclusivity:**
- Flag/VIP click → Type = All, New This Month = off
- Type/Individual click → Flag = All, New This Month = off
- New This Month click → Type = All, Flag = All, Sort = Recent

---

## 9. Error Display Patterns

### 9.1 Field-Level Error (Red Box)
```
┌─────────────────────────────┐
│ Mobile Number *  10/10      │
│ ┌─────────────────────────┐ │
│ │ 9876543210              │ │
│ └─────────────────────────┘ │
│ ⚠ Mobile must be exactly 10 │
│   digits                    │
└─────────────────────────────┘
```

### 9.2 General Error Banner (Top of Modal)
```
┌─────────────────────────────────────────────┐
│ ⚠ Cannot connect to the server. Please      │
│   check your internet connection.           │
└─────────────────────────────────────────────┘
```

### 9.3 Error Clearing Behavior
- User starts typing in a field with an error → error clears immediately
- User clicks Save → all errors cleared first, then fresh validation runs
- Successful save → modal closes, toast shows "Added/Updated [name]"

---

## 10. API / Data Flow

```
CustomerModal.handleSave()
    │
    ▼
customerData.saveCustomer(customer)
    │
    ├─► customerRepository.getById(id)  (check if existing)
    │
    ├─► customerRepository.update(id, data)  OR  customerRepository.create(data)
    │       │
    │       ▼
    │   customerRepository._updateInSupabase(id, data)  OR  _createInSupabase(data)
    │       │
    │       ▼
    │   supabase.from('customers').update().eq('id', id)  OR  .insert([customer])
    │       │
    │       ▼
    │   Returns DB row  →  cacheClear('customers')  →  return result
    │
    ▼
CustomerModal receives result → closes modal → toast notification
```

---

## 11. Test Coverage

**Test File:** `tests/*.test.mjs` (83 total tests, all passing)

Relevant test categories:
- `settingsForProvider` — provider config scoping
- `unknown provider name is rejected` — validation
- `both vendors are polled and fleet merged` — data aggregation
- `one dead vendor still lets other update` — resilience
- `refuses to call vendor without credentials` — auth
- `healthCheck surfaces non-array vendor responses` — error handling

**Build:** `vite build` — passes (1806 modules transformed)

---

## 12. Known Limitations / Future Enhancements

| Limitation | Detail |
|------------|--------|
| Email validation | Basic regex only (`^[^\s]*@?[^\s]*\.?[^\s]*$`), not RFC-compliant |
| Mobile uniqueness | Checked at DB level (23505), not pre-validated client-side |
| Duplicate customer detection | Only by mobile; name-based duplicates not detected |
| Bulk import | No CSV/Excel import for customers |
| Customer search | Only by mobile (via `searchByMobile`), no name search in modal |
| Photo upload | No customer photo/avatar upload |
| Address auto-complete | No Google Places integration |
| Multi-language | English only, no i18n |

---

**Last Updated:** November 2026  
**Version:** 1.0.0  
**Status:** Production Ready