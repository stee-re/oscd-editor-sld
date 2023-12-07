The editor is based around a drag-and-drop palette.

It is designed to stay as close as possible to the requirements of IEC 61850-6, but uses its own namespace, `esld` for storing coordinates, orientation, connectivity information (within a `Private` element) and identifying transformer types.

It allows drawing of multiple Substations and this can be used together with other plugins to add logical nodes and enhanced functionality.

When drawing an SLD, keep the following modelling requirements in mind:

- Voltage Levels are generally the first item which must be drawn
- Bays must be within Voltage Levels
- Transformers can be placed within Substations, Voltage Levels or Bays (within the SCL file, this is based on their center of rotation)
- Primary system busbars are modelled as a Bay with a single Connectivity Node

There is also a restriction in the SCL schema which means a Substation without a Voltage Level or a Voltage Level a Bay is not valid -- this means there is often a schema error noticed after initialising a Substation or placing a Voltage Level.

## Actions

During any action, pressing Esc on the keyboard will cancel it, as will clicking the cross button on the palette.

### Placing

After clicking on the palette, items can be placed.
While placing, a middle click will rotate the item and also its label text for placement.

### Earthing

To earth a terminal, right-click on it.

### Rotating and Mirroring

To rotate an item, middle-click on it.

To mirror, right-click and select the "Mirror" option.
Mirroring only works in the vertical dimension and to avoid confusion should be done before rotating a symbol.

### Connecting

Conducting Equipment connects via Terminal elements which are created when a connection is made (the `pathName` is shown on hover) to an orange connection point.
Neutral Points for Power Transformer are the blue-green connection points.

Connections are made by clicking on conducting equipment and then clicking for each "stop" in an orthogonal path.
Connections for Power Transformers must be made from the Power Transformer to the Conducting Equipment.

Generally it is best to connect the main "power flow" path first and then connect single terminal items (earthing switches, Voltage Transformers) subsequently otherwise it is possible to not have any orange terminals left to connect to.

When clicking on an item, valid connection points are shown with an orange triangle.
In the initial implementation, Power Transformers cannot be directly connected to Power Transformers (as ).

### Moving

When moving an item, its connections are removed and reconnection is required. Sometimes this can affect a large number of connections (especially on Busbars).
It can be helpful to use undo (Ctrl+Z) and redo (Ctrl+Y) to see these connections.

Labels can be moved by left-clicking on them.

Immediately adjacent items can be connected by clicking on the orange circle and then the orange triangle.

### Copying

A copy made is available on the context menu and can also be achieved by "shift-clicking" inside a Voltage Level, Bay or on a Conducting Equipment item after which the copy can be placed.

It can be useful to "window scroll" while using a mouse scroll button which defaults to vertical scrolling can be restricted to horizontal scrolling by holding down the Shift on the keyboard.

Currently copying of Voltage Levels and Bays results in the removal of any connectivity where that connectivity reaches outside of the Voltage Level or Bay.

### Deleting

When an item is deleted, any unnecessary Connectivity Nodes are removed.
When necessary, Connectivity Nodes are allocated to new bays "on the fly".

## Context Menus

Most features are also available by right-clicking on an item or its label which brings up a context menu.
Directly opening the SCL wizard for the specific element can be done by middle-clicking on the item.
This is especially useful for renaming items quickly.
For Tap Changers, this must be done by using the context menu, "Edit Tap Changer" option.

## Other Features

A "Hide Labels" toggle button on the palette (adjacent to the zoom in and zoom out) is available to turn labels on and off to allow display of only the SLD symbols.

### SVG Export

A "Download" button is available for an SVG 1.1 export which can be readily used in other software. Bay and voltage levels lines are removed in this view.

If desirable, the "Hide Labels" button can be toggled prior to using this.

### Transformers

The tool currently supports a subset of possible transformers:

- earthing transformers with one or two windings
- auto-transformers with or without a tertiary
- two and three winding transformers

Only one winding may have a Load Tap Changer.

## Issues and Opportunities

Feel free to [file an issue](https://github.com/OMICRONEnergy/oscd-designer/issues) if you would like to see a feature developed or discuss a problem that you've identified.

Current limitations which impact on usability are:

- Power Transformers cannot be connected directly to other Power Transformers
- Resizing or moving of busbars results in a loss of other Conducting Equipment connections
- Copying of Voltage Levels and Bays results in a loss of connections of the same Connectivity Node
- Only 3 phase functionality is provided (no single phase modelling)
