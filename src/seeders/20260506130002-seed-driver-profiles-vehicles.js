'use strict';

const USERS = {
  driver1: '00000000-0000-4000-a000-000000000007',
  driver2: '00000000-0000-4000-a000-000000000008',
  driver3: '00000000-0000-4000-a000-000000000009',
};

const PROFILES = {
  driver1: '00000000-0000-4000-b000-000000000001',
  driver2: '00000000-0000-4000-b000-000000000002',
  driver3: '00000000-0000-4000-b000-000000000003',
};

const VEHICLES = {
  driver1: '00000000-0000-4000-c000-000000000001',
  driver2: '00000000-0000-4000-c000-000000000002',
  driver3: '00000000-0000-4000-c000-000000000003',
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('driver_profiles', [
      {
        id: PROFILES.driver1,
        user_id: USERS.driver1,
        license_number: 'TN-DL-2024-001',
        license_expiry: '2028-12-31',
        cin: '12345678',
        cin_delivered_at: '2020-01-15',
        cin_photo_front: null,
        cin_photo_back: null,
        license_photo_front: null,
        license_photo_back: null,
        is_approved: true,
        is_online: true,
        rating: 4.75,
        total_rides: 120,
        last_lat: 36.80610000,
        last_lng: 10.16590000,
        last_seen_at: now,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: PROFILES.driver2,
        user_id: USERS.driver2,
        license_number: 'TN-DL-2024-002',
        license_expiry: '2027-06-30',
        cin: '23456789',
        cin_delivered_at: '2019-05-20',
        cin_photo_front: null,
        cin_photo_back: null,
        license_photo_front: null,
        license_photo_back: null,
        is_approved: true,
        is_online: false,
        rating: 4.50,
        total_rides: 85,
        last_lat: 36.81200000,
        last_lng: 10.17100000,
        last_seen_at: new Date(Date.now() - 3600000), // 1 hour ago
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: PROFILES.driver3,
        user_id: USERS.driver3,
        license_number: 'TN-DL-2025-003',
        license_expiry: '2029-03-15',
        cin: '34567890',
        cin_delivered_at: '2021-08-10',
        cin_photo_front: null,
        cin_photo_back: null,
        license_photo_front: null,
        license_photo_back: null,
        is_approved: false,
        is_online: false,
        rating: null,
        total_rides: 0,
        last_lat: null,
        last_lng: null,
        last_seen_at: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('vehicles', [
      {
        id: VEHICLES.driver1,
        driver_id: PROFILES.driver1,
        make: 'Peugeot',
        model: '208',
        year: 2022,
        plate_number: '123 TUN 4567',
        color: 'White',
        vehicle_type: 'economy',
        doors: 4,
        seats: 4,
        photo_front: null,
        photo_side: null,
        photo_back: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: VEHICLES.driver2,
        driver_id: PROFILES.driver2,
        make: 'Mercedes',
        model: 'C-Class',
        year: 2023,
        plate_number: '234 TUN 5678',
        color: 'Black',
        vehicle_type: 'premium',
        doors: 4,
        seats: 4,
        photo_front: null,
        photo_side: null,
        photo_back: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: VEHICLES.driver3,
        driver_id: PROFILES.driver3,
        make: 'Volkswagen',
        model: 'Transporter',
        year: 2021,
        plate_number: '345 TUN 6789',
        color: 'Silver',
        vehicle_type: 'van',
        doors: 4,
        seats: 8,
        photo_front: null,
        photo_side: null,
        photo_back: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('vehicles', null, {});
    await queryInterface.bulkDelete('driver_profiles', null, {});
  },
};
