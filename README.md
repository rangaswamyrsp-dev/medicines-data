# Medicine Stock Entry

Create a simple, modern, mobile-friendly Medicine Inventory Data Entry Web App.

1. Purpose

The app will replace manual Excel data entry. Users should enter medicine/product details through a simple form, and every submitted record should automatically be added to a connected Google Sheet.

The existing Excel format contains these columns:

Item Name

MFR

TYPE

Batch Code

Pack Size

No. of Pack

Units

MRP

Expiry Date

2. User Authentication

Create a simple user login/signup system.

Fields:

User Name

Email

Password

When a user adds inventory data, automatically store the User Name with every submitted record.

This will allow the admin to filter the Google Sheet by user and identify who entered each record.

3. Inventory Entry Form

Create a clean card-based form with these fields:

Item Name

Text input

Required

Manufacturer (MFR)

Searchable/selectable field

Allow selecting existing manufacturers

Allow user to create a new manufacturer directly from the form

TYPE

Searchable dropdown

Example values:

Tablet

Capsule

Syrup

Injection

Cream

Gel

Drops

Powder

Suspension

Other

Include "+ Add New Type"

If the required type doesn't exist, user can create it without leaving the form

Newly created types should automatically become available in the dropdown

Batch Code

Text input

Required

Pack Size

Text/number input

Examples:

10 Tablets

15 Tablets

100 ml

60 ml

90 ml

1 Tube

1 Bottle

No. of Pack

Numeric input

Only allow valid positive numbers

Units

Searchable dropdown

Examples:

Tablets

Capsules

Strips

Bottles

Tubes

Boxes

Pieces

Vials

Sachets

Packs

ml

g

kg

Include "+ Add New Unit"

Users can create a new unit if it is not available

Newly created units should automatically appear in the dropdown

MRP

Numeric/currency input

Validate that the value is a valid positive number

Expiry Date

Do NOT require a full day/date

Provide separate selectors:

Month

Year

Example: 09 / 2028

Month dropdown should contain January–December

Year dropdown should contain a useful range of years

Store the final value consistently in Google Sheets, preferably as MM/YYYY

4. Submit

Add a large "Add Inventory" button.

After successful submission:

Save the record

Send the record to Google Sheets

Show a success message

Clear the form

Keep the user logged in

Prevent duplicate accidental submissions by disabling the button while saving.

5. Google Sheets Integration

Connect the application to Google Sheets.

Every submitted row should contain:

User NameItem NameMFRTYPEBatch CodePack SizeNo. of PackUnitsMRPExpiry MonthExpiry Year

Automatically append every new submission as a new row.

Do not overwrite existing records.

6. Admin/User Filtering

Create an inventory records page.

For normal users:

Show records entered by their own account.

For admin:

Show all records.

Add filters for:

User

Item Name

Manufacturer

Type

Batch Code

Expiry Year

Add search functionality.

7. Interface Design

Design should be:

Very simple

Professional

Mobile-first

Fast

Easy for pharmacy/shop staff

Large touch-friendly buttons

Clean white/card interface

Blue primary color

Clear labels

Minimal unnecessary elements

On mobile, display fields one below another.

On desktop, use a responsive two-column layout where appropriate.

8. Validation

Required fields:

Item Name

MFR

TYPE

Batch Code

Pack Size

No. of Pack

Units

MRP

Expiry Month

Expiry Year

Show clear validation messages.

Examples:

"Item Name is required"

"Please enter a valid MRP"

"Please select expiry month"

"Please select expiry year"

9. Data Structure

Create database tables/collections for:

Users

id

name

email

role

created_at

Types

id

type_name

created_by

created_at

Units

id

unit_name

created_by

created_at

Manufacturers

id

manufacturer_name

created_by

created_at

Inventory

id

user_id

item_name

manufacturer

type

batch_code

pack_size

no_of_pack

units

mrp

expiry_month

expiry_year

created_at

10. Important UX Requirement

The user should NOT need to leave the inventory form to create a missing Type, Unit, or Manufacturer.

For example:

TYPE: [Tablet ▼] [+ Add New]

If the user clicks "+ Add New":

Open a small modal

Enter new type

Click Save

Automatically add it to the database

Automatically select the newly created type in the current form

Do the same for Units and Manufacturers.

11. Google Sheet Access

Provide an Admin Settings section where the administrator can configure/connect the Google Sheet.

Keep Google credentials/API secrets secure. Never expose private API keys or service-account credentials in frontend code.

12. Extra Features

Add:

Recent entries

Total records

Today's entries

User-wise entry count

Search

Filters

Edit record

Delete record with confirmation

Export option if practical

The main priority is fast and easy medicine inventory data entry, especially on Android/mobile devices.

Use a clean professional UI and make the complete application production-ready. Form Submission Behavior

When the user clicks the "Add Inventory" button:

Save the record successfully.

Show a success message:

"✅ Medicine added successfully"

Automatically clear all fields.

Keep the form open.

Display a fresh empty form ready for the next entry.

Do not redirect to another page.

Keep the cursor focused on the Item Name field for faster data entry.

Allow continuous entry of multiple medicines without reloading the page.

Show a small success notification (toast) at the top or bottom of the screen.

Keep the user logged in.

Optional Faster Workflow

After successful save:

Show:

Previous Entry Saved ✅

Open a new blank form instantly.

Auto-focus on Item Name.

User can immediately start entering the next medicine.

This workflow is optimized for pharmacy staff entering hundreds of medicines continuously from invoices or stock lists. @connector:microsoft_excel:"Microsoft Excel"

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/653aa13f-fdff-4777-9674-b059b0c76772).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
