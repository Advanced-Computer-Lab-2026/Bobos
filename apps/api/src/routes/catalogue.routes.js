import express from 'express';
import {
  createOffering,
  getOfferings,
  getOfferingById,
  updateOffering,
  updateOfferingSlot,
  deleteOffering,
  deleteOfferingSlot,
  togglePublishOffering,
} from '../controllers/catalogue.controller.js';

const router = express.Router();

// Req 22: Create a course offering with its slots
router.post('/offerings', createOffering);

// Req 23: View course offerings for an academic term
router.get('/offerings', getOfferings);

// Req 23: Select an offering to view all of its details and slots
router.get('/offerings/:id', getOfferingById);

// Req 25: Update a course offering (top-level fields)
router.put('/offerings/:id', updateOffering);

// Req 25: Update a specific slot within a course offering
router.put('/offerings/:id/slots/:slotId', updateOfferingSlot);

// Req 26: Delete a course offering
router.delete('/offerings/:id', deleteOffering);

// Req 26: Delete a specific slot from a course offering
router.delete('/offerings/:id/slots/:slotId', deleteOfferingSlot);

// Req 27: Publish or unpublish a course offering
router.patch('/offerings/:id/publish', togglePublishOffering);

export default router;
