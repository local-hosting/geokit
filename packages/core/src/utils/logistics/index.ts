/**
 * Logistics and transportation utilities
 * Route optimization, fleet management, and delivery planning
 */

import { haversineMeters } from '../distance';
import { getBounds, getCenter } from '../bounds';
import type { Coordinate } from '../../types';

/**
 * Vehicle routing utilities
 */
export interface Vehicle {
  id: string;
  location: Coordinate;
  capacity: number;
  currentLoad?: number;
  maxDistance?: number; // max daily distance in meters
  currentDistance?: number;
}

export interface Delivery {
  id: string;
  location: Coordinate;
  weight?: number;
  priority?: number; // 1-5, higher is more urgent
  timeWindow?: {
    start: Date;
    end: Date;
  };
}

/**
 * Simple nearest-neighbor route optimization
 * For more complex optimization, integrate with OR-Tools or similar
 */
export function optimizeRoute(
  startLocation: Coordinate,
  deliveries: Delivery[],
  returnToStart: boolean = true
): { route: Delivery[]; totalDistance: number } {
  if (deliveries.length === 0) {
    return { route: [], totalDistance: 0 };
  }

  const route: Delivery[] = [];
  const remaining = [...deliveries];
  let currentLocation = startLocation;
  let totalDistance = 0;

  // Greedy nearest-neighbor approach
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = haversineMeters(currentLocation)(remaining[0].location);

    for (let i = 1; i < remaining.length; i++) {
      const distance = haversineMeters(currentLocation)(remaining[i].location);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const nextDelivery = remaining.splice(nearestIndex, 1)[0];
    route.push(nextDelivery);
    totalDistance += nearestDistance;
    currentLocation = nextDelivery.location;
  }

  // Return to start if requested
  if (returnToStart && route.length > 0) {
    totalDistance += haversineMeters(currentLocation)(startLocation);
  }

  return { route, totalDistance };
}

/**
 * Fleet assignment - assign deliveries to vehicles
 */
export function assignDeliveriesToFleet(
  vehicles: Vehicle[],
  deliveries: Delivery[]
): Array<{ vehicle: Vehicle; deliveries: Delivery[]; route?: Delivery[] }> {
  const assignments: Array<{ vehicle: Vehicle; deliveries: Delivery[]; route?: Delivery[] }> = 
    vehicles.map(vehicle => ({ vehicle, deliveries: [] }));

  // Sort deliveries by priority (highest first)
  const sortedDeliveries = [...deliveries].sort((a, b) => 
    (b.priority || 0) - (a.priority || 0)
  );

  for (const delivery of sortedDeliveries) {
    let bestVehicle = 0;
    let bestScore = Infinity;

    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const assignment = assignments[i];

      // Check capacity constraints
      const currentWeight = assignment.deliveries.reduce((sum, d) => sum + (d.weight || 0), 0);
      if (vehicle.capacity && currentWeight + (delivery.weight || 0) > vehicle.capacity) {
        continue;
      }

      // Calculate distance from vehicle's current location or last delivery
      const lastLocation = assignment.deliveries.length > 0 
        ? assignment.deliveries[assignment.deliveries.length - 1].location
        : vehicle.location;
      
      const distance = haversineMeters(lastLocation)(delivery.location);
      
      // Simple scoring: prefer closer vehicles with more remaining capacity
      const remainingCapacity = vehicle.capacity - currentWeight;
      const score = distance / (remainingCapacity + 1);

      if (score < bestScore) {
        bestScore = score;
        bestVehicle = i;
      }
    }

    assignments[bestVehicle].deliveries.push(delivery);
  }

  // Optimize route for each vehicle
  return assignments.map(assignment => {
    if (assignment.deliveries.length > 0) {
      const { route } = optimizeRoute(assignment.vehicle.location, assignment.deliveries);
      return { ...assignment, route };
    }
    return assignment;
  });
}

/**
 * Geofencing utilities for fleet tracking
 */
export interface Geofence {
  id: string;
  name: string;
  center: Coordinate;
  radius: number; // meters
  type: 'entry' | 'exit' | 'both';
}

/**
 * Check if vehicle entered/exited geofences
 */
export function checkGeofenceEvents(
  previousLocation: Coordinate,
  currentLocation: Coordinate,
  geofences: Geofence[]
): Array<{ geofence: Geofence; event: 'entry' | 'exit' }> {
  const events: Array<{ geofence: Geofence; event: 'entry' | 'exit' }> = [];

  for (const geofence of geofences) {
    const wasInside = haversineMeters(previousLocation)(geofence.center) <= geofence.radius;
    const isInside = haversineMeters(currentLocation)(geofence.center) <= geofence.radius;

    if (!wasInside && isInside && (geofence.type === 'entry' || geofence.type === 'both')) {
      events.push({ geofence, event: 'entry' });
    } else if (wasInside && !isInside && (geofence.type === 'exit' || geofence.type === 'both')) {
      events.push({ geofence, event: 'exit' });
    }
  }

  return events;
}

/**
 * Calculate estimated time of arrival (ETA)
 */
export function calculateETA(
  currentLocation: Coordinate,
  destination: Coordinate,
  averageSpeed: number = 50 // km/h
): Date {
  const distance = haversineMeters(currentLocation)(destination);
  const timeHours = (distance / 1000) / averageSpeed;
  const timeMs = timeHours * 60 * 60 * 1000;
  
  return new Date(Date.now() + timeMs);
}