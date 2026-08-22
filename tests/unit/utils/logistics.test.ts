import { describe, expect, it } from 'vitest';
import {
  assignDeliveriesToFleet,
  calculateETA,
  checkGeofenceEvents,
  optimizeRoute,
  type Delivery,
  type Geofence,
  type Vehicle,
} from '../../../src/utils/logistics';

const depot: [number, number] = [40.7128, -74.006];
const nearby: [number, number] = [40.72, -74.0];
const farther: [number, number] = [40.8, -73.9];

describe('logistics', () => {
  describe('optimizeRoute', () => {
    it('returns empty route for no deliveries', () => {
      expect(optimizeRoute(depot, [])).toEqual({ route: [], totalDistance: 0 });
    });

    it('orders deliveries by nearest-neighbor from the start', () => {
      const deliveries: Delivery[] = [
        { id: 'far', location: farther },
        { id: 'near', location: nearby },
      ];

      const { route } = optimizeRoute(depot, deliveries, false);
      expect(route.map((d) => d.id)).toEqual(['near', 'far']);
    });

    it('adds return distance when returnToStart is true', () => {
      const oneStop: Delivery[] = [{ id: 'near', location: nearby }];
      const withReturn = optimizeRoute(depot, oneStop, true).totalDistance;
      const withoutReturn = optimizeRoute(depot, oneStop, false).totalDistance;
      expect(withReturn).toBeGreaterThan(withoutReturn);
    });
  });

  describe('assignDeliveriesToFleet', () => {
    it('assigns deliveries to vehicles and optimizes each route', () => {
      const vehicles: Vehicle[] = [
        { id: 'v1', location: depot, capacity: 100 },
        { id: 'v2', location: farther, capacity: 100 },
      ];
      const deliveries: Delivery[] = [
        { id: 'd1', location: nearby, weight: 10, priority: 5 },
        { id: 'd2', location: farther, weight: 10, priority: 1 },
      ];

      const assignments = assignDeliveriesToFleet(vehicles, deliveries);
      expect(assignments).toHaveLength(2);
      expect(assignments.some((a) => a.deliveries.length > 0)).toBe(true);
      expect(assignments.find((a) => a.deliveries.length > 0)?.route?.length).toBeGreaterThan(0);
    });

    it('prefers vehicles with remaining capacity when possible', () => {
      const vehicles: Vehicle[] = [
        { id: 'small', location: depot, capacity: 12 },
        { id: 'large', location: depot, capacity: 50 },
      ];
      const deliveries: Delivery[] = [
        { id: 'd1', location: nearby, weight: 10, priority: 2 },
        { id: 'd2', location: farther, weight: 10, priority: 1 },
      ];

      const assignments = assignDeliveriesToFleet(vehicles, deliveries);
      const largeAssignment = assignments.find((a) => a.vehicle.id === 'large');
      expect(largeAssignment?.deliveries).toHaveLength(2);
    });
  });

  describe('checkGeofenceEvents', () => {
    const geofence: Geofence = {
      id: 'zone',
      name: 'Depot',
      center: depot,
      radius: 2000,
      type: 'both',
    };

    it('detects entry when crossing into a geofence', () => {
      const outside: [number, number] = [40.9, -74.2];
      const events = checkGeofenceEvents(outside, depot, [geofence]);
      expect(events).toEqual([{ geofence, event: 'entry' }]);
    });

    it('detects exit when leaving a geofence', () => {
      const outside: [number, number] = [40.9, -74.2];
      const events = checkGeofenceEvents(depot, outside, [geofence]);
      expect(events).toEqual([{ geofence, event: 'exit' }]);
    });

    it('returns no events when staying inside', () => {
      const stillInside: [number, number] = [40.713, -74.005];
      const events = checkGeofenceEvents(depot, stillInside, [geofence]);
      expect(events).toEqual([]);
    });
  });

  describe('calculateETA', () => {
    it('returns a future date based on distance and speed', () => {
      const before = Date.now();
      const eta = calculateETA(depot, nearby, 50);
      expect(eta.getTime()).toBeGreaterThan(before);
    });
  });
});
