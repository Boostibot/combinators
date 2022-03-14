<?php
foreach (glob(dirname(__FILE__) . "/tasks/*.php") as $filename)
{
    include $filename;
}
?>